const { rm } = await import("node:fs/promises");
const { join } = await import("node:path");
const desktop = await import("../apps/desktop/scripts/app-state.mjs");
const mobile = await import("../apps/mobile/scripts/app-state.mjs");
const tablet = await import("../apps/tablet/scripts/app-state.mjs");

const tmp = join(process.cwd(), ".tmp");
process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH = join(tmp, "receipt-summary-desktop.vault.json");
process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH = join(tmp, "receipt-summary-desktop.runtime.json");
process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH = join(tmp, "receipt-summary-desktop.device.json");
process.env.LOGINTO_DESKTOP_SYNC_RECEIPT_PATH = join(tmp, "receipt-summary-desktop.receipts.json");
process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH = join(tmp, "receipt-summary-mobile.vault.json");
process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH = join(tmp, "receipt-summary-mobile.runtime.json");
process.env.LOGINTO_MOBILE_DEVICE_IDENTITY_PATH = join(tmp, "receipt-summary-mobile.device.json");
process.env.LOGINTO_MOBILE_SYNC_RECEIPTS_PATH = join(tmp, "receipt-summary-mobile.receipts.json");
process.env.LOGINTO_TABLET_SHELL_VAULT_PATH = join(tmp, "receipt-summary-tablet.vault.json");
process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH = join(tmp, "receipt-summary-tablet.runtime.json");
process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH = join(tmp, "receipt-summary-tablet.device.json");
process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH = join(tmp, "receipt-summary-tablet.receipts.json");

for (const path of [
  process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH,
  process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH,
  process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH,
  process.env.LOGINTO_DESKTOP_SYNC_RECEIPT_PATH,
  process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH,
  process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH,
  process.env.LOGINTO_MOBILE_DEVICE_IDENTITY_PATH,
  process.env.LOGINTO_MOBILE_SYNC_RECEIPTS_PATH,
  process.env.LOGINTO_TABLET_SHELL_VAULT_PATH,
  process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH,
  process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH,
  process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH
]) {
  await rm(path, { force: true });
  await rm(`${path}.tmp`, { force: true });
}

desktop.resetDesktopShellRuntimeForTests?.();
mobile.resetMobileShellRuntimeForTests?.();
tablet.resetTabletShellRuntimeForTests?.();

await writeReceiptFile(process.env.LOGINTO_DESKTOP_SYNC_RECEIPT_PATH, {
  id: "desktop_receipt",
  direction: "outgoing",
  status: "success",
  syncedAt: "2026-06-29T09:30:00.000Z",
  peerDeviceId: "device_phone",
  peerName: "Phone",
  sentCount: 3,
  receivedCount: 1,
  conflictCount: 2,
  transport: "local-network"
});
await writeReceiptFile(process.env.LOGINTO_MOBILE_SYNC_RECEIPTS_PATH, {
  id: "mobile_receipt",
  direction: "incoming",
  status: "success",
  receivedAt: "2026-06-29T09:31:00.000Z",
  senderDeviceId: "device_desktop",
  senderName: "Desktop",
  receivedCount: 4,
  conflicts: 1
});
await writeReceiptFile(process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH, {
  id: "tablet_receipt",
  direction: "outgoing",
  status: "failure",
  syncedAt: "2026-06-29T09:32:00.000Z",
  peerName: "Desktop",
  sentCount: 2,
  receivedCount: 0,
  conflictCount: 0,
  error: "offline"
});

const desktopState = await desktop.createDesktopShellAppState({
  syncReceiptPath: process.env.LOGINTO_DESKTOP_SYNC_RECEIPT_PATH
});
const mobileState = await mobile.createMobileShellAppState();
assertReceiptSummary(desktopState.sync.lastReceiptSummary, "Phone", 3, 1, 2, "success");
assertReceiptSummary(mobileState.syncPanel.lastReceiptSummary, "Desktop", 0, 4, 1, "success");
const tabletState = await tablet.createTabletShellAppState();
assertReceiptSummary(tabletState.syncPanel.lastReceiptSummary, "Desktop", 2, 0, 0, "failure");
assertFailureRecovery(tabletState.syncPanel.lastReceiptSummary, {
  reason: "target-offline",
  title: "目标设备离线",
  action: "rescan"
});
assertSyncCenter(desktopState.sync.syncCenter, {
  status: "pending-review",
  recentSuccessCount: 1
});
assertSyncCenter(mobileState.syncPanel.syncCenter, {
  status: "pending-review",
  recentSuccessCount: 1
});
assertSyncCenter(tabletState.syncPanel.syncCenter, {
  status: "needs-attention",
  failureCount: 1,
  itemKind: "failure",
  itemAction: "rescan"
});

console.log("Sync receipt summary smoke passed");

async function writeReceiptFile(path, receipt) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ receipts: [receipt] }, null, 2), "utf8");
}

function assertReceiptSummary(summary, peerName, sentCount, receivedCount, conflictCount, status) {
  if (
    !summary
    || summary.peerName !== peerName
    || summary.sentCount !== sentCount
    || summary.receivedCount !== receivedCount
    || summary.conflictCount !== conflictCount
    || summary.status !== status
    || !summary.label?.includes(peerName)
  ) {
    throw new Error(`Unexpected sync receipt summary: ${JSON.stringify(summary)}`);
  }
}

function assertFailureRecovery(summary, expected) {
  if (
    summary.failureReason !== expected.reason
    || summary.recoveryTitle !== expected.title
    || !summary.recoveryCopy
    || !summary.recoveryActions?.includes(expected.action)
  ) {
    throw new Error(`Unexpected sync failure recovery summary: ${JSON.stringify(summary)}`);
  }
}

function assertSyncCenter(center, expected) {
  if (
    !center
    || center.status !== expected.status
    || (expected.recentSuccessCount !== undefined && center.recentSuccessCount !== expected.recentSuccessCount)
    || (expected.failureCount !== undefined && center.failureCount !== expected.failureCount)
    || !Number.isFinite(center.trustedCount)
    || !Number.isFinite(center.pendingCount)
    || !center.guidance
    || !center.actionLabel
    || (expected.itemKind && !center.items?.some((item) => item.kind === expected.itemKind && item.action === expected.itemAction))
  ) {
    throw new Error(`Unexpected sync center summary: ${JSON.stringify(center)}`);
  }
}
