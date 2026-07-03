import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "tablet-to-desktop-desktop.vault-snapshot.json",
  "tablet-to-desktop-tablet.vault-snapshot.json",
  "tablet-to-desktop-desktop.runtime-state.json",
  "tablet-to-desktop-tablet.runtime-state.json",
  "tablet-to-desktop-desktop.device-identity.json",
  "tablet-to-desktop-tablet.device-identity.json",
  "tablet-to-desktop-desktop.sync-confirmations.json",
  "tablet-to-desktop-tablet.sync-confirmations.json",
  "tablet-to-desktop-desktop.sync-receipts.json",
  "tablet-to-desktop-tablet.sync-receipts.json"
].map((name) => join(root, ".tmp", name));

for (const file of terminalFiles) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

delete process.env.LOGINTO_SHARED_TERMINAL_VAULT_PATH;
process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH = terminalFiles[0];
process.env.LOGINTO_TABLET_SHELL_VAULT_PATH = terminalFiles[1];
process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH = terminalFiles[2];
process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH = terminalFiles[3];
process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH = terminalFiles[4];
process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH = terminalFiles[5];
process.env.LOGINTO_DESKTOP_SYNC_CONFIRMATIONS_PATH = terminalFiles[6];
process.env.LOGINTO_TABLET_SYNC_CONFIRMATIONS_PATH = terminalFiles[7];
process.env.LOGINTO_TERMINAL_SYNC_RECEIPTS_PATH = terminalFiles[8];
process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH = terminalFiles[9];

const desktop = await import("../apps/desktop/scripts/dev-server.mjs");
const tablet = await import("../apps/tablet/scripts/dev-server.mjs");
const sync = await import("../packages/sync-core/src/index.ts");

const desktopServer = desktop.createDesktopShellServer();
const tabletServer = tablet.createTabletShellServer();

try {
  await Promise.all([
    listen(desktopServer),
    listen(tabletServer)
  ]);

  const desktopBaseUrl = createBaseUrl(desktopServer);
  const tabletBaseUrl = createBaseUrl(tabletServer);
  const desktopSummary = await getJson(`${desktopBaseUrl}/api/sync/summary`);
  const tabletSummary = await getJson(`${tabletBaseUrl}/api/sync/summary`);
  const tabletDevice = tabletSummary.device;
  const desktopDevice = desktopSummary.device;
  const desktopDeviceId = desktopDevice.id;

  await trustDesktopWithTablet(desktopBaseUrl, tabletBaseUrl, tabletDevice);
  await trustTabletWithDesktop(desktopBaseUrl, tabletBaseUrl);

  const directPush = await postJsonAllowFailure(`${tabletBaseUrl}/api/sync/push`, {
    desktopBaseUrl,
    desktopDeviceId,
    desktopDeviceName: desktopDevice.name,
    desktopPublicKeyBase64: desktopDevice.publicKeyBase64
  });
  if (directPush.ok || !directPush.text.includes("Sync confirmation is required")) {
    throw new Error(`Expected tablet push to require preview confirmation: ${directPush.text}`);
  }

  let preview = await postJson(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl,
    desktopDeviceId,
    desktopDeviceName: desktopDevice.name,
    desktopPublicKeyBase64: desktopDevice.publicKeyBase64
  });
  if (preview.confirmation.peerDevice.id !== desktopDeviceId) {
    throw new Error("Expected tablet sync preview to bind the desktop peer");
  }
  if (!preview.confirmation.requestedAt || preview.confirmation.transport !== "local-network") {
    throw new Error("Expected tablet sync preview to include request time and transport");
  }
  const preSyncState = await getJson(`${tabletBaseUrl}/api/app-state`);
  await patchJson(`${tabletBaseUrl}/api/review/notes`, {
    recordId: preSyncState.selectedRecord.id,
    notes: "Tablet changed this record after preview, so the old confirmation must be rejected."
  });
  const stalePush = await postJsonAllowFailure(`${tabletBaseUrl}/api/sync/push`, {
    desktopBaseUrl,
    desktopDeviceId,
    desktopDeviceName: desktopDevice.name,
    desktopPublicKeyBase64: desktopDevice.publicKeyBase64,
    confirmationId: preview.confirmation.id
  });
  assertPreviewDriftFailure(stalePush, "tablet -> desktop stale confirmation");
  preview = await postJson(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl,
    desktopDeviceId,
    desktopDeviceName: desktopDevice.name,
    desktopPublicKeyBase64: desktopDevice.publicKeyBase64
  });

  const result = await postJson(`${tabletBaseUrl}/api/sync/push`, {
    desktopBaseUrl,
    desktopDeviceId,
    desktopDeviceName: desktopDevice.name,
    desktopPublicKeyBase64: desktopDevice.publicKeyBase64,
    confirmationId: preview.confirmation.id
  });
  if (!result.transportPackage?.encrypted || result.transportPackage.plaintextExchangeIncluded) {
    throw new Error("Expected tablet sync push to transmit only encrypted packages");
  }
  if (result.desktopReceipt?.peerDeviceId !== tabletDevice.id || result.desktopReceipt.status !== "success") {
    throw new Error("Expected desktop to persist a successful incoming receipt from tablet");
  }
  const replay = await postJsonAllowFailure(`${tabletBaseUrl}/api/sync/push`, {
    desktopBaseUrl,
    desktopDeviceId,
    desktopDeviceName: desktopDevice.name,
    desktopPublicKeyBase64: desktopDevice.publicKeyBase64,
    confirmationId: preview.confirmation.id
  });
  assertConsumedConfirmationReplay(replay, "tablet -> desktop confirmation replay", "confirmed");
  const tabletReloaded = await getJson(`${tabletBaseUrl}/api/app-state`);
  if (tabletReloaded.syncPanel.lastReceipt?.peerDeviceId !== desktopDeviceId || tabletReloaded.syncPanel.lastReceipt?.status !== "success") {
    throw new Error("Expected tablet to persist a successful outgoing receipt");
  }

  const conflictSourceState = await getJson(`${tabletBaseUrl}/api/app-state`);
  const conflictRecord = conflictSourceState.viewState.recent.find((record) => record.title === "Home Router Admin");
  if (!conflictRecord?.id) {
    throw new Error("Expected tablet app-state to expose a conflict candidate record");
  }
  await patchJson(`${tabletBaseUrl}/api/review/notes`, {
    recordId: conflictRecord.id,
    notes: "Tablet kept this router note during manual merge."
  });
  await patchJson(`${desktopBaseUrl}/api/records`, {
    recordId: conflictRecord.id,
    notes: "Desktop edited this router note before the next sync."
  });
  const conflictPreview = await postJson(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl,
    desktopDeviceId,
    desktopDeviceName: desktopDevice.name,
    desktopPublicKeyBase64: desktopDevice.publicKeyBase64
  });
  const conflict = conflictPreview.confirmation.conflicts.find((item) => item.recordId === conflictRecord.id);
  if (!conflict) {
    throw new Error("Expected tablet sync preview to expose a record conflict after both sides edit the same record");
  }
  if (!conflict.fields.some((field) => field.key === "notes")) {
    throw new Error("Expected tablet conflict preview to expose the changed notes field");
  }
  const manualMerge = await postJson(`${tabletBaseUrl}/api/sync/push`, {
    desktopBaseUrl,
    desktopDeviceId,
    desktopDeviceName: desktopDevice.name,
    desktopPublicKeyBase64: desktopDevice.publicKeyBase64,
    confirmationId: conflictPreview.confirmation.id,
    decisions: [
      {
        conflictId: conflict.id,
        resolution: "manual-merge",
        manualMerge: {
          fields: [
            {
              fieldKey: "notes",
              sensitivity: "private",
              source: "local"
            }
          ]
        }
      }
    ]
  });
  const handledConflicts = (manualMerge.desktopReceipt?.conflictCount ?? 0)
    + (manualMerge.desktopReceipt?.conflicts ?? 0)
    + (manualMerge.desktopReceipt?.resolvedConflicts ?? 0);
  if (handledConflicts < 1) {
    throw new Error("Expected tablet manual merge push to report at least one conflict");
  }
  assertConflictResolutionSummary(manualMerge.desktopReceipt, "desktop incoming manual merge receipt");
  assertConflictResolutionSummary(manualMerge.tabletReceipt, "tablet outgoing manual merge receipt");
  const postMergeDesktopState = await getJson(`${desktopBaseUrl}/api/app-state`);
  const postMergeTabletState = await getJson(`${tabletBaseUrl}/api/app-state`);
  assertConflictResolutionSummary(postMergeDesktopState.sync.lastReceiptSummary, "desktop visible manual merge receipt");
  assertConflictResolutionSummary(postMergeTabletState.syncPanel.lastReceiptSummary, "tablet visible manual merge receipt");

  console.log("Tablet to desktop sync smoke test passed.");
  console.log(JSON.stringify({
    tabletDevice: tabletDevice.id,
    desktopDevice: desktopDeviceId,
    previewSendChanges: preview.confirmation.preview.sendChanges,
    sentChanges: result.sentChanges,
    desktopReceived: result.desktopReceipt.receivedCount,
    conflictRecord: conflictRecord.title,
    conflictFields: conflict.fields.map((field) => field.key),
    manualMergeConflicts: handledConflicts,
    manualMergeSummary: manualMerge.desktopReceipt.conflictResolutionSummary
  }, null, 2));
} finally {
  await Promise.all([
    closeServer(desktopServer),
    closeServer(tabletServer)
  ]);
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

function assertConsumedConfirmationReplay(result, label, status) {
  if (result.ok) {
    throw new Error(`Expected ${label} to reject reused sync confirmation`);
  }
  if (!result.text.includes(`not pending: ${status}`)) {
    throw new Error(`Expected ${label} to fail with consumed confirmation status ${status}: ${result.text}`);
  }
}

function assertPreviewDriftFailure(result, label) {
  if (result.ok) {
    throw new Error(`Expected ${label} to reject a stale sync preview`);
  }
  if (!result.text.includes("Sync preview changed after confirmation")) {
    throw new Error(`Expected ${label} to require a fresh preview: ${result.text}`);
  }
}

function assertConflictResolutionSummary(receipt, label) {
  const summary = receipt?.conflictResolutionSummary;
  const text = receipt?.conflictResolutionText ?? receipt?.displayLabel ?? JSON.stringify(summary ?? []);
  if (!Array.isArray(summary) || summary.length < 1) {
    throw new Error(`Expected ${label} to include conflict resolution summary`);
  }
  if (!text.includes("Home Router Admin") || !text.includes("手动合并") || !text.includes("notes:本机")) {
    throw new Error(`Expected ${label} to show the record title, merge action, and field source: ${text}`);
  }
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
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
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text
  };
}

async function patchJson(url, body) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`PATCH ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function trustDesktopWithTablet(desktopBaseUrl, tabletBaseUrl, tabletDevice) {
  const localPairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  const remotePairingPayload = sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: tabletDevice.id,
      name: tabletDevice.name,
      kind: tabletDevice.kind,
      publicKeyBase64: tabletDevice.publicKeyBase64,
      now: () => "2026-12-20T09:00:00.000Z"
    }),
    sessionId: "tablet_to_desktop_tablet",
    localEndpoint: tabletBaseUrl,
    ttlSeconds: 31_536_000,
    now: () => "2026-12-20T09:00:00.000Z"
  });
  const verification = sync.createPairingVerification(localPairing.pairingPayload, remotePairingPayload);
  const result = await postJson(`${desktopBaseUrl}/api/pairing/confirm`, {
    localSessionId: localPairing.pairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode
  });
  if (!result.ok) {
    throw new Error("Expected desktop to trust tablet before tablet sync");
  }
}

async function trustTabletWithDesktop(desktopBaseUrl, tabletBaseUrl) {
  const pairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  const result = await postJson(`${tabletBaseUrl}/api/pairing/trust`, {
    payloadText: pairing.qrPayloadText,
    confirmedCode: pairing.sixDigitCode
  });
  if (!result.ok) {
    throw new Error("Expected tablet to trust desktop before tablet sync");
  }
}
