import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const workspaceRoot = process.cwd();
const runId = `${Date.now()}-${process.pid}`;
const sandboxRoot = join(workspaceRoot, ".tmp", `sync-demo-failure-smoke-${runId}`);

process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH = join(sandboxRoot, "mobile.vault.json");
process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH = join(sandboxRoot, "mobile.runtime.json");
process.env.LOGINTO_MOBILE_SYNC_RECEIPTS_PATH = join(sandboxRoot, "mobile.receipts.json");
process.env.LOGINTO_MOBILE_SYNC_CONFIRMATIONS_PATH = join(sandboxRoot, "mobile.confirmations.json");
process.env.LOGINTO_MOBILE_DEVICE_IDENTITY_PATH = join(sandboxRoot, "mobile.device.json");
process.env.LOGINTO_MOBILE_TRUSTED_DEVICE_REVOCATIONS_PATH = join(sandboxRoot, "mobile.revocations.json");

process.env.LOGINTO_TABLET_SHELL_VAULT_PATH = join(sandboxRoot, "tablet.vault.json");
process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH = join(sandboxRoot, "tablet.runtime.json");
process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH = join(sandboxRoot, "tablet.receipts.json");
process.env.LOGINTO_TABLET_SYNC_CONFIRMATIONS_PATH = join(sandboxRoot, "tablet.confirmations.json");
process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH = join(sandboxRoot, "tablet.device.json");
process.env.LOGINTO_TABLET_TRUSTED_DEVICE_REVOCATIONS_PATH = join(sandboxRoot, "tablet.revocations.json");

const desktop = await import("../apps/desktop/scripts/app-state.mjs");
const mobile = await import("../apps/mobile/scripts/app-state.mjs");
const tablet = await import("../apps/tablet/scripts/app-state.mjs");

const desktopPaths = {
  vaultPath: join(sandboxRoot, "desktop.vault.json"),
  runtimeStatePath: join(sandboxRoot, "desktop.runtime.json"),
  syncReceiptPath: join(sandboxRoot, "desktop.receipts.json"),
  syncConfirmationPath: join(sandboxRoot, "desktop.confirmations.json"),
  deviceIdentityPath: join(sandboxRoot, "desktop.device.json"),
  trustedDeviceRevocationPath: join(sandboxRoot, "desktop.revocations.json")
};

desktop.resetDesktopShellRuntimeForTests?.();
mobile.resetMobileShellRuntimeForTests();
tablet.resetTabletShellRuntimeForTests();

async function assertDemoFailure(label, run, getConnectionState) {
  const timedOut = await run({ reason: "timeout" });
  assert.equal(getConnectionState(timedOut.appState).stage, "timed-out", `${label} timeout stage`);
  assert.equal(timedOut.reason, "timeout", `${label} timeout reason`);

  const rejected = await run({ reason: "peer-rejected" });
  assert.equal(getConnectionState(rejected.appState).stage, "peer-rejected", `${label} rejected stage`);
  assert.equal(rejected.reason, "peer-rejected", `${label} rejected reason`);
}

await assertDemoFailure(
  "desktop",
  (input) => desktop.simulateDesktopShellSyncFailure({ ...desktopPaths, ...input }),
  (appState) => appState.sync.connectionState
);

await assertDemoFailure(
  "mobile",
  (input) => mobile.simulateMobileShellSyncFailure(input),
  (appState) => appState.syncPanel.connectionState
);

await assertDemoFailure(
  "tablet",
  (input) => tablet.simulateTabletShellSyncFailure(input),
  (appState) => appState.syncPanel.connectionState
);

async function writeConfirmations(path, confirmations) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify({ confirmations }, null, 2), "utf8");
}

function createPendingConfirmation(id, peerDevice, peerBaseUrl = "http://127.0.0.1:4173") {
  return {
    id,
    sessionId: `${id}_session`,
    status: "pending",
    direction: "demo-confirmation-action",
    requestedAt: "2026-07-02T09:00:00.000Z",
    expiresAt: "2026-07-02T09:05:00.000Z",
    transport: "local-network",
    localDevice: {
      id: "device_local_demo",
      name: "Local Demo Device",
      kind: "desktop",
      publicKeyBase64: "local-demo-key"
    },
    peerDevice,
    peerBaseUrl,
    preview: {
      sendChanges: 1,
      receiveChanges: 1,
      conflicts: 0,
      categories: ["account"]
    },
    recordsToSend: [],
    recordsToReceive: [],
    conflicts: []
  };
}

async function assertConfirmationAction(label, prepare, run, getSyncPanel) {
  const rejectedId = `${label}_reject_confirmation`;
  await prepare([createPendingConfirmation(rejectedId, {
    id: label === "desktop" ? "device_mobile_shell" : "device_desktop_shell",
    name: label === "desktop" ? "LoginTo Phone Shell" : "LoginTo Desktop Shell",
    kind: label === "desktop" ? "phone" : "desktop",
    publicKeyBase64: "demo-peer-key"
  })]);
  const rejected = await run({ confirmationId: rejectedId, action: "reject" });
  assert.equal(getSyncPanel(rejected.appState).connectionState.stage, "peer-rejected", `${label} reject stage`);
  assert.equal(getSyncPanel(rejected.appState).pendingConfirmation, undefined, `${label} rejected confirmation should leave pending list`);
  assert.equal(rejected.reason, "peer-rejected", `${label} reject reason`);

  const timeoutId = `${label}_timeout_confirmation`;
  await prepare([createPendingConfirmation(timeoutId, {
    id: label === "desktop" ? "device_mobile_shell" : "device_desktop_shell",
    name: label === "desktop" ? "LoginTo Phone Shell" : "LoginTo Desktop Shell",
    kind: label === "desktop" ? "phone" : "desktop",
    publicKeyBase64: "demo-peer-key"
  })]);
  const timedOut = await run({ confirmationId: timeoutId, action: "timeout" });
  assert.equal(getSyncPanel(timedOut.appState).connectionState.stage, "timed-out", `${label} timeout stage`);
  assert.equal(getSyncPanel(timedOut.appState).pendingConfirmation, undefined, `${label} timed-out confirmation should leave pending list`);
  assert.equal(timedOut.reason, "timeout", `${label} timeout reason`);
}

await assertConfirmationAction(
  "desktop",
  (confirmations) => writeConfirmations(desktopPaths.syncConfirmationPath, confirmations),
  (input) => desktop.actOnDesktopShellSyncConfirmation({ ...desktopPaths, ...input }),
  (appState) => appState.sync
);

await assertConfirmationAction(
  "mobile",
  (confirmations) => writeConfirmations(process.env.LOGINTO_MOBILE_SYNC_CONFIRMATIONS_PATH, confirmations),
  (input) => mobile.actOnMobileShellSyncConfirmation(input),
  (appState) => appState.syncPanel
);

await assertConfirmationAction(
  "tablet",
  (confirmations) => writeConfirmations(process.env.LOGINTO_TABLET_SYNC_CONFIRMATIONS_PATH, confirmations),
  (input) => tablet.actOnTabletShellSyncConfirmation(input),
  (appState) => appState.syncPanel
);

console.log("Sync demo failure state smoke passed.");
