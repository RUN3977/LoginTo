import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "delete-sync-desktop.vault-snapshot.json",
  "delete-sync-mobile.vault-snapshot.json",
  "delete-sync-desktop.runtime-state.json",
  "delete-sync-mobile.runtime-state.json",
  "delete-sync-desktop.device-identity.json",
  "delete-sync-mobile.device-identity.json",
  "delete-sync-desktop.sync-confirmations.json",
  "delete-sync-mobile.sync-confirmations.json",
  "delete-sync-desktop.sync-receipts.json",
  "delete-sync-mobile.sync-receipts.json"
].map((name) => join(root, ".tmp", name));

for (const file of terminalFiles) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

delete process.env.LOGINTO_SHARED_TERMINAL_VAULT_PATH;
process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH = terminalFiles[0];
process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH = terminalFiles[1];
process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH = terminalFiles[2];
process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH = terminalFiles[3];
process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH = terminalFiles[4];
process.env.LOGINTO_MOBILE_DEVICE_IDENTITY_PATH = terminalFiles[5];
process.env.LOGINTO_DESKTOP_SYNC_CONFIRMATIONS_PATH = terminalFiles[6];
process.env.LOGINTO_MOBILE_SYNC_CONFIRMATIONS_PATH = terminalFiles[7];
process.env.LOGINTO_TERMINAL_SYNC_RECEIPTS_PATH = terminalFiles[8];
process.env.LOGINTO_MOBILE_SYNC_RECEIPTS_PATH = terminalFiles[9];

const desktop = await import("../apps/desktop/scripts/dev-server.mjs");
const mobile = await import("../apps/mobile/scripts/dev-server.mjs");
const sync = await import("../packages/sync-core/src/index.ts");

const desktopServer = desktop.createDesktopShellServer();
const mobileServer = mobile.createMobileShellServer();

try {
  await Promise.all([
    listen(desktopServer),
    listen(mobileServer)
  ]);
  const desktopBaseUrl = createBaseUrl(desktopServer);
  const mobileBaseUrl = createBaseUrl(mobileServer);
  const mobileInitial = await fetchJson(`${mobileBaseUrl}/api/app-state`);
  await trustDesktopAndPhone(desktopBaseUrl, mobileBaseUrl, mobileInitial.runtime.deviceId);

  const initialPreview = await postJson(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: mobileBaseUrl,
    targetDeviceId: mobileInitial.runtime.deviceId
  });
  await postJson(`${desktopBaseUrl}/api/sync/push`, {
    targetKind: "phone",
    targetBaseUrl: mobileBaseUrl,
    targetDeviceId: mobileInitial.runtime.deviceId,
    confirmationId: initialPreview.confirmation.id
  });

  const desktopVault = await readVault(terminalFiles[0]);
  const github = findRecordByTitle(desktopVault, "GitHub");
  const mobileAfterSeed = await readVault(terminalFiles[1]);
  if (!mobileAfterSeed.records.some((record) => record.id === github.id)) {
    throw new Error("Expected initial sync to copy the desktop GitHub record to mobile");
  }

  const deleteResult = await deleteJson(`${desktopBaseUrl}/api/records`, {
    recordId: github.id,
    deletedAt: "2026-12-20T09:10:00.000Z"
  });
  if (!deleteResult.ok || deleteResult.deletedRecordId !== github.id) {
    throw new Error("Expected desktop delete API to create a local deletion tombstone");
  }

  const deletePreview = await postJson(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: mobileBaseUrl,
    targetDeviceId: mobileInitial.runtime.deviceId,
    requestedAt: "2026-12-20T09:11:00.000Z"
  });
  const deletePreviewItem = deletePreview.confirmation.recordsToSend.find((item) => item.record.id === github.id);
  if (deletePreviewItem?.operation !== "delete") {
    throw new Error(`Expected sync preview to show a delete operation for the tombstoned record: ${JSON.stringify(deletePreview.confirmation.recordsToSend)}`);
  }

  const pushedDelete = await postJson(`${desktopBaseUrl}/api/sync/push`, {
    targetKind: "phone",
    targetBaseUrl: mobileBaseUrl,
    targetDeviceId: mobileInitial.runtime.deviceId,
    confirmationId: deletePreview.confirmation.id,
    syncedAt: "2026-12-20T09:12:00.000Z"
  });
  if (!pushedDelete.ok || pushedDelete.targetReceipt.appliedChanges < 1) {
    throw new Error(`Expected delete sync push to apply at least one change: ${JSON.stringify(pushedDelete)}`);
  }

  const mobileAfterDelete = await readVault(terminalFiles[1]);
  if (mobileAfterDelete.records.some((record) => record.id === github.id)) {
    throw new Error("Expected synced delete tombstone to remove the record from mobile vault");
  }

  console.log("Sync delete propagation smoke test passed.");
  console.log(JSON.stringify({
    recordId: github.id,
    previewOperation: deletePreviewItem.operation,
    appliedChanges: pushedDelete.targetReceipt.appliedChanges,
    mobileRecordsAfterDelete: mobileAfterDelete.records.length
  }, null, 2));
} finally {
  await Promise.all([
    closeServer(desktopServer),
    closeServer(mobileServer)
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

async function fetchJson(url) {
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

async function trustDesktopAndPhone(desktopBaseUrl, mobileBaseUrl, mobileDeviceId) {
  const desktopPairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  const mobileSummary = await fetchJson(`${mobileBaseUrl}/api/sync/summary`);
  const remotePairingPayload = createRemotePairingPayload(mobileSummary.device, mobileBaseUrl, "delete_sync_phone");
  const verification = sync.createPairingVerification(desktopPairing.pairingPayload, remotePairingPayload);
  const desktopTrust = await postJson(`${desktopBaseUrl}/api/pairing/confirm`, {
    localSessionId: desktopPairing.pairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode
  });
  if (!desktopTrust.ok) {
    throw new Error("Expected desktop to trust phone before delete sync");
  }
  const phoneTrust = await postJson(`${mobileBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  if (!phoneTrust.ok) {
    throw new Error("Expected phone to trust desktop before delete sync");
  }
}

function createRemotePairingPayload(device, endpoint, sessionId) {
  return sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: device.id,
      name: device.name,
      kind: device.kind,
      publicKeyBase64: device.publicKeyBase64,
      now: () => "2026-12-20T09:00:00.000Z"
    }),
    sessionId,
    localEndpoint: endpoint,
    ttlSeconds: 31_536_000,
    now: () => "2026-12-20T09:00:00.000Z"
  });
}

async function readVault(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function findRecordByTitle(vault, title) {
  const record = vault.records.find((item) => item.title === title);
  if (!record) {
    throw new Error(`Record not found: ${title}`);
  }
  return record;
}
