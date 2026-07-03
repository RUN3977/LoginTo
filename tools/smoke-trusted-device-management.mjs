import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "trusted-devices-desktop.vault-snapshot.json",
  "trusted-devices-mobile.vault-snapshot.json",
  "trusted-devices-tablet.vault-snapshot.json",
  "trusted-devices-desktop.runtime-state.json",
  "trusted-devices-mobile.runtime-state.json",
  "trusted-devices-tablet.runtime-state.json",
  "trusted-devices-desktop.device-identity.json",
  "trusted-devices-mobile.device-identity.json",
  "trusted-devices-tablet.device-identity.json",
  "trusted-devices-desktop.sync-confirmations.json",
  "trusted-devices-mobile.sync-confirmations.json",
  "trusted-devices-tablet.sync-confirmations.json",
  "trusted-devices-desktop.sync-receipts.json",
  "trusted-devices-mobile.sync-receipts.json",
  "trusted-devices-tablet.sync-receipts.json",
  "trusted-devices-desktop.revocations.json",
  "trusted-devices-mobile.revocations.json",
  "trusted-devices-tablet.revocations.json"
].map((name) => join(root, ".tmp", name));

for (const file of terminalFiles) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

delete process.env.LOGINTO_SHARED_TERMINAL_VAULT_PATH;
process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH = terminalFiles[0];
process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH = terminalFiles[1];
process.env.LOGINTO_TABLET_SHELL_VAULT_PATH = terminalFiles[2];
process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH = terminalFiles[3];
process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH = terminalFiles[4];
process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH = terminalFiles[5];
process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH = terminalFiles[6];
process.env.LOGINTO_MOBILE_DEVICE_IDENTITY_PATH = terminalFiles[7];
process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH = terminalFiles[8];
process.env.LOGINTO_DESKTOP_SYNC_CONFIRMATIONS_PATH = terminalFiles[9];
process.env.LOGINTO_MOBILE_SYNC_CONFIRMATIONS_PATH = terminalFiles[10];
process.env.LOGINTO_TABLET_SYNC_CONFIRMATIONS_PATH = terminalFiles[11];
process.env.LOGINTO_TERMINAL_SYNC_RECEIPTS_PATH = terminalFiles[12];
process.env.LOGINTO_MOBILE_SYNC_RECEIPTS_PATH = terminalFiles[13];
process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH = terminalFiles[14];
process.env.LOGINTO_DESKTOP_TRUSTED_DEVICE_REVOCATIONS_PATH = terminalFiles[15];
process.env.LOGINTO_MOBILE_TRUSTED_DEVICE_REVOCATIONS_PATH = terminalFiles[16];
process.env.LOGINTO_TABLET_TRUSTED_DEVICE_REVOCATIONS_PATH = terminalFiles[17];

const desktop = await import("../apps/desktop/scripts/dev-server.mjs");
const mobile = await import("../apps/mobile/scripts/dev-server.mjs");
const tablet = await import("../apps/tablet/scripts/dev-server.mjs");
const sync = await import("../packages/sync-core/src/index.ts");

assertTrustedDeviceDetailUi(await readText("apps/desktop/prototype/index.html"), {
  label: "desktop",
  detailAction: "data-device-detail-action=\"toggle\"",
  detailPanel: "data-device-detail",
  repairAction: "data-sync-recovery-action=\"repair\""
});
assertTrustedDeviceDetailUi(await readText("apps/mobile/prototype/index.html"), {
  label: "mobile",
  detailAction: "data-mobile-device-detail-action=\"toggle\"",
  detailPanel: "data-mobile-device-detail",
  repairAction: "data-mobile-sync-recovery-action=\"repair\""
});
assertTrustedDeviceDetailUi(await readText("apps/tablet/prototype/index.html"), {
  label: "tablet",
  detailAction: "data-tablet-device-detail-action=\"toggle\"",
  detailPanel: "data-tablet-device-detail",
  repairAction: "data-tablet-sync-recovery-action=\"repair\""
});

const desktopServer = desktop.createDesktopShellServer();
const mobileServer = mobile.createMobileShellServer();
const tabletServer = tablet.createTabletShellServer();

try {
  await Promise.all([
    listen(desktopServer),
    listen(mobileServer),
    listen(tabletServer)
  ]);

  const desktopBaseUrl = createBaseUrl(desktopServer);
  const mobileBaseUrl = createBaseUrl(mobileServer);
  const tabletBaseUrl = createBaseUrl(tabletServer);

  const desktopSummary = await getJson(`${desktopBaseUrl}/api/sync/summary`);
  const mobileSummary = await getJson(`${mobileBaseUrl}/api/sync/summary`);
  const tabletSummary = await getJson(`${tabletBaseUrl}/api/sync/summary`);

  assertEmptyTrustedDeviceSummaries(await getJson(`${desktopBaseUrl}/api/app-state`), "desktop initial");
  assertEmptyTrustedDeviceSummaries(await getJson(`${mobileBaseUrl}/api/app-state`), "mobile initial");
  assertEmptyTrustedDeviceSummaries(await getJson(`${tabletBaseUrl}/api/app-state`), "tablet initial");

  const desktopPairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  await trustDesktopWithDevice(desktopBaseUrl, desktopPairing.pairingPayload, mobileSummary.device, "pairing_trusted_mobile");
  await trustDesktopWithDevice(desktopBaseUrl, desktopPairing.pairingPayload, tabletSummary.device, "pairing_trusted_tablet");
  await postJson(`${mobileBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  await postJson(`${tabletBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });

  const desktopState = await getJson(`${desktopBaseUrl}/api/app-state`);
  const mobileState = await getJson(`${mobileBaseUrl}/api/app-state`);
  const tabletState = await getJson(`${tabletBaseUrl}/api/app-state`);

  assertTrustedDeviceSummaries(desktopState.sync.trustedDeviceSummaries, [
    mobileSummary.device,
    tabletSummary.device
  ], "desktop");
  assertTrustedDeviceSummaries(mobileState.syncPanel.trustedDeviceSummaries, [
    desktopSummary.device
  ], "mobile");
  assertTrustedDeviceSummaries(tabletState.syncPanel.trustedDeviceSummaries, [
    desktopSummary.device
  ], "tablet");
  assertSyncCenterCounts(desktopState.sync.syncCenter, {
    label: "desktop paired",
    trustedCount: 2,
    revokedCount: 0,
    status: "ready"
  });
  assertSyncCenterCounts(mobileState.syncPanel.syncCenter, {
    label: "mobile paired",
    trustedCount: 1,
    revokedCount: 0,
    status: "ready"
  });
  assertSyncCenterCounts(tabletState.syncPanel.syncCenter, {
    label: "tablet paired",
    trustedCount: 1,
    revokedCount: 0,
    status: "ready"
  });

  const rejectedUnconfirmedRevocation = await deleteJsonAllowFailure(`${desktopBaseUrl}/api/trusted-devices`, {
    deviceId: mobileSummary.device.id
  });
  assertRejectedUnconfirmedRevocation(rejectedUnconfirmedRevocation, "desktop missing device-name confirmation");

  const revokedDesktopMobile = await deleteJson(`${desktopBaseUrl}/api/trusted-devices`, {
    deviceId: mobileSummary.device.id,
    confirmDeviceName: mobileSummary.device.name
  });
  const revokedMobileDesktop = await deleteJson(`${mobileBaseUrl}/api/trusted-devices`, {
    deviceId: desktopSummary.device.id,
    confirmDeviceName: desktopSummary.device.name
  });
  const revokedTabletDesktop = await deleteJson(`${tabletBaseUrl}/api/trusted-devices`, {
    deviceId: desktopSummary.device.id,
    confirmDeviceName: desktopSummary.device.name
  });

  assertRevokedTrustedDeviceSummaries(
    revokedDesktopMobile.appState.sync.trustedDeviceSummaries,
    mobileSummary.device,
    [tabletSummary.device],
    "desktop after mobile revoke"
  );
  assertRevokedTrustedDeviceSummaries(
    revokedMobileDesktop.appState.syncPanel.trustedDeviceSummaries,
    desktopSummary.device,
    [],
    "mobile after desktop revoke"
  );
  assertRevokedTrustedDeviceSummaries(
    revokedTabletDesktop.appState.syncPanel.trustedDeviceSummaries,
    desktopSummary.device,
    [],
    "tablet after desktop revoke"
  );
  assertTrustedDeviceRevocations(
    revokedDesktopMobile.appState.sync.trustedDeviceRevocations,
    mobileSummary.device,
    "desktop"
  );
  assertTrustedDeviceRevocations(
    revokedMobileDesktop.appState.syncPanel.trustedDeviceRevocations,
    desktopSummary.device,
    "mobile"
  );
  assertTrustedDeviceRevocations(
    revokedTabletDesktop.appState.syncPanel.trustedDeviceRevocations,
    desktopSummary.device,
    "tablet"
  );
  assertSyncCenterCounts(revokedDesktopMobile.appState.sync.syncCenter, {
    label: "desktop after revoke",
    trustedCount: 1,
    revokedCount: 1,
    status: "ready",
    itemKind: "revoked"
  });
  assertSyncCenterCounts(revokedMobileDesktop.appState.syncPanel.syncCenter, {
    label: "mobile after revoke",
    trustedCount: 0,
    revokedCount: 1,
    status: "pairing-needed",
    itemKind: "revoked"
  });
  assertSyncCenterCounts(revokedTabletDesktop.appState.syncPanel.syncCenter, {
    label: "tablet after revoke",
    trustedCount: 0,
    revokedCount: 1,
    status: "pairing-needed",
    itemKind: "revoked"
  });

  const revokedDesktopPreview = await postJsonAllowFailure(`${desktopBaseUrl}/api/sync/preview`, {
    target: "phone",
    targetBaseUrl: mobileBaseUrl
  });
  const revokedMobilePreview = await postJsonAllowFailure(`${mobileBaseUrl}/api/sync/preview`, {
    desktopBaseUrl
  });
  const revokedTabletPreview = await postJsonAllowFailure(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl
  });
  assertRejectedAfterRevocation(revokedDesktopPreview, "desktop to revoked mobile");
  assertRejectedAfterRevocation(revokedMobilePreview, "mobile to revoked desktop");
  assertRejectedAfterRevocation(revokedTabletPreview, "tablet to revoked desktop");

  console.log("Trusted device management smoke passed.");
  console.log(JSON.stringify({
    desktopTrustedDevices: desktopState.sync.trustedDeviceSummaries,
    mobileTrustedDevices: mobileState.syncPanel.trustedDeviceSummaries,
    tabletTrustedDevices: tabletState.syncPanel.trustedDeviceSummaries,
    revokedDesktopTrustedDevices: revokedDesktopMobile.appState.sync.trustedDeviceSummaries,
    revokedMobileTrustedDevices: revokedMobileDesktop.appState.syncPanel.trustedDeviceSummaries,
    revokedTabletTrustedDevices: revokedTabletDesktop.appState.syncPanel.trustedDeviceSummaries
  }, null, 2));
} finally {
  await Promise.all([
    closeServer(desktopServer),
    closeServer(mobileServer),
    closeServer(tabletServer)
  ]);
}

function assertEmptyTrustedDeviceSummaries(appState, label) {
  const summaries = appState.sync?.trustedDeviceSummaries ?? appState.syncPanel?.trustedDeviceSummaries;
  if (!Array.isArray(summaries)) {
    throw new Error(`Expected ${label} to expose trustedDeviceSummaries`);
  }
  if (summaries.length !== 0) {
    throw new Error(`Expected ${label} trustedDeviceSummaries to start empty`);
  }
}

function assertTrustedDeviceSummaries(summaries, expectedDevices, label) {
  if (!Array.isArray(summaries)) {
    throw new Error(`Expected ${label} trustedDeviceSummaries to be an array`);
  }
  for (const device of expectedDevices) {
    const summary = summaries.find((item) => item.id === device.id);
    if (!summary) {
      throw new Error(`Expected ${label} to list trusted device ${device.name}`);
    }
    if (summary.name !== device.name || summary.kind !== device.kind) {
      throw new Error(`Expected ${label} trusted device identity to match ${device.id}`);
    }
    if (summary.status !== "trusted" || summary.statusLabel !== "已信任") {
      throw new Error(`Expected ${label} trusted device status to be visible`);
    }
    if (!/^[0-9a-f]{4}-[0-9a-f]{4}$/.test(summary.publicKeyFingerprint)) {
      throw new Error(`Expected ${label} trusted device to expose a stable key fingerprint`);
    }
    if (!summary.reason?.includes("同步前仍会显示设备名、时间和变更摘要")) {
      throw new Error(`Expected ${label} trusted device summary to explain per-sync confirmation`);
    }
    if (summary.actionLabel !== "同步确认") {
      throw new Error(`Expected ${label} trusted device to expose the sync confirmation action`);
    }
  }
}

function assertRevokedTrustedDeviceSummaries(summaries, revokedDevice, remainingDevices, label) {
  if (!Array.isArray(summaries)) {
    throw new Error(`Expected ${label} trustedDeviceSummaries to be an array`);
  }
  if (summaries.some((item) => item.id === revokedDevice.id)) {
    throw new Error(`Expected ${label} to remove revoked device ${revokedDevice.name}`);
  }
  for (const device of remainingDevices) {
    if (!summaries.some((item) => item.id === device.id)) {
      throw new Error(`Expected ${label} to keep trusted device ${device.name}`);
    }
  }
}

function assertRejectedAfterRevocation(result, label) {
  if (result.ok) {
    throw new Error(`Expected ${label} sync preview to be rejected after trust revocation`);
  }
  if (result.status < 400) {
    throw new Error(`Expected ${label} sync preview to return an error status`);
  }
}

function assertRejectedUnconfirmedRevocation(result, label) {
  if (result.ok) {
    throw new Error(`Expected ${label} to reject unconfirmed trusted-device revocation`);
  }
  if (result.status < 400) {
    throw new Error(`Expected ${label} to return an error status`);
  }
}

function assertTrustedDeviceRevocations(revocations, revokedDevice, label) {
  if (!Array.isArray(revocations)) {
    throw new Error(`Expected ${label} trustedDeviceRevocations to be an array`);
  }
  const event = revocations.find((item) => item.deviceId === revokedDevice.id);
  if (!event) {
    throw new Error(`Expected ${label} to expose revocation audit event for ${revokedDevice.name}`);
  }
  if (event.deviceName !== revokedDevice.name || event.deviceKind !== revokedDevice.kind) {
    throw new Error(`Expected ${label} revocation event to retain revoked device identity`);
  }
  if (!/^[0-9a-f]{4}-[0-9a-f]{4}$/.test(event.publicKeyFingerprint)) {
    throw new Error(`Expected ${label} revocation event to expose device fingerprint`);
  }
  if (event.confirmation !== "device-name-confirmed") {
    throw new Error(`Expected ${label} revocation event to record explicit confirmation`);
  }
}

function assertSyncCenterCounts(center, expected) {
  if (!center) {
    throw new Error(`Expected ${expected.label} to expose syncCenter`);
  }
  if (center.trustedCount !== expected.trustedCount || center.revokedCount !== expected.revokedCount) {
    throw new Error(`Expected ${expected.label} syncCenter counts to be ${expected.trustedCount}/${expected.revokedCount}, got ${center.trustedCount}/${center.revokedCount}`);
  }
  if (center.status !== expected.status) {
    throw new Error(`Expected ${expected.label} syncCenter status ${expected.status}, got ${center.status}`);
  }
  if (!center.guidance || !center.actionLabel || !Array.isArray(center.items)) {
    throw new Error(`Expected ${expected.label} syncCenter to include guidance, action label, and items`);
  }
  if (expected.itemKind && !center.items.some((item) => item.kind === expected.itemKind)) {
    throw new Error(`Expected ${expected.label} syncCenter to include ${expected.itemKind} item`);
  }
}

function assertTrustedDeviceDetailUi(html, contract) {
  if (!html.includes(contract.detailAction)) {
    throw new Error(`Expected ${contract.label} trusted-device cards to expose a detail toggle`);
  }
  if (!html.includes(contract.detailPanel)) {
    throw new Error(`Expected ${contract.label} trusted-device cards to expose a detail panel`);
  }
  if (!html.includes(contract.repairAction)) {
    throw new Error(`Expected ${contract.label} trusted-device detail flow to expose repair pairing`);
  }
  if (!html.includes("设备 ID") || !html.includes("恢复")) {
    throw new Error(`Expected ${contract.label} trusted-device details to show identity and recovery copy`);
  }
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function createBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function readText(path) {
  return readFile(join(root, path), "utf8");
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function postJsonAllowFailure(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await response.text()
  };
}

async function deleteJson(url, body) {
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`DELETE ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function deleteJsonAllowFailure(url, body) {
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await response.text()
  };
}

async function trustDesktopWithDevice(desktopBaseUrl, localPairingPayload, device, sessionId) {
  const remotePairingPayload = sync.createPairingPayload({
    device,
    sessionId,
    localEndpoint: `http://127.0.0.1:${device.kind === "tablet" ? 4178 : 4177}`,
    ttlSeconds: 31_536_000,
    now: () => "2026-12-20T09:00:00.000Z"
  });
  const verification = sync.createPairingVerification(localPairingPayload, remotePairingPayload);
  const trusted = await postJson(`${desktopBaseUrl}/api/pairing/confirm`, {
    localSessionId: localPairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode,
    ttlSeconds: 31_536_000
  });
  if (!trusted.ok) {
    throw new Error(`Expected desktop to trust ${device.id}`);
  }
}
