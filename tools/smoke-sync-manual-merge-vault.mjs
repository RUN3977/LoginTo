import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "manual-merge-desktop.vault-snapshot.json",
  "manual-merge-mobile.vault-snapshot.json",
  "manual-merge-desktop.runtime-state.json",
  "manual-merge-mobile.runtime-state.json",
  "manual-merge-desktop.device-identity.json",
  "manual-merge-mobile.device-identity.json",
  "manual-merge-desktop.sync-confirmations.json",
  "manual-merge-mobile.sync-confirmations.json",
  "manual-merge-desktop.sync-receipts.json",
  "manual-merge-mobile.sync-receipts.json"
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
  await listen(desktopServer);
  await listen(mobileServer);
  const desktopBaseUrl = createBaseUrl(desktopServer);
  const mobileBaseUrl = createBaseUrl(mobileServer);

  const desktopInitial = await fetchJson(`${desktopBaseUrl}/api/app-state`);
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

  const desktopVaultAfterSeed = await readVault(terminalFiles[0]);
  const githubRecord = findRecordByTitle(desktopVaultAfterSeed, "GitHub");
  await patchJson(`${mobileBaseUrl}/api/records`, {
    recordId: githubRecord.id,
    notes: "phone-local manual merge note"
  });
  const mobileLocalVault = await readVault(terminalFiles[1]);
  const mobileLocalNotes = findField(findRecordById(mobileLocalVault, githubRecord.id), "notes");

  await patchJson(`${desktopBaseUrl}/api/records`, {
    recordId: githubRecord.id,
    notes: "desktop-remote manual merge note",
    title: "GitHub Remote Manual Merge"
  });
  const desktopRemoteVault = await readVault(terminalFiles[0]);
  const desktopRemoteNotes = findField(findRecordById(desktopRemoteVault, githubRecord.id), "notes");
  if (mobileLocalNotes.valueCipher === desktopRemoteNotes.valueCipher) {
    throw new Error("Expected local and remote notes fields to diverge before manual merge");
  }

  const conflictPreview = await postJson(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: mobileBaseUrl,
    targetDeviceId: mobileInitial.runtime.deviceId,
    senderBaseUrl: desktopBaseUrl
  });
  const previewConflict = conflictPreview.confirmation.conflicts.find((conflict) => conflict.recordId === githubRecord.id);
  if (!previewConflict) {
    throw new Error("Expected desktop-to-phone preview to expose the GitHub record conflict");
  }
  if (!previewConflict.fields.some((field) => field.side === "both" && field.key === "title")) {
    throw new Error(`Expected conflict preview to expose title metadata differences: ${JSON.stringify(previewConflict.fields)}`);
  }

  const mergeResult = await postJson(`${mobileBaseUrl}/api/sync/confirmation-action`, {
    confirmationId: `incoming_${conflictPreview.confirmation.id}`,
    action: "confirm",
    decisions: [
      {
        conflictId: previewConflict.id,
        resolution: "manual-merge",
        manualMerge: {
          fields: [
            {
              fieldKey: "title",
              source: "remote"
            },
            {
              fieldKey: "notes",
              source: "remote"
            }
          ]
        }
      }
    ]
  });
  const autoSync = mergeResult.resultDelivery?.data?.autoSync;
  if (!autoSync) {
    throw new Error(`Expected receiver confirmation to trigger desktop auto sync: ${JSON.stringify(mergeResult)}`);
  }
  if (autoSync.targetReceipt.resolvedConflicts < 1 || autoSync.targetReceipt.conflictCount !== 0) {
    throw new Error(`Expected manual merge to resolve the incoming conflict: ${JSON.stringify(autoSync.targetReceipt)}`);
  }
  const mobileStateAfterMerge = await fetchJson(`${mobileBaseUrl}/api/app-state`);
  const receiptSummary = mobileStateAfterMerge.syncPanel?.lastReceiptSummary;
  if (
    !receiptSummary?.conflictResolutionText?.includes("title:对方")
    || !receiptSummary?.conflictResolutionText?.includes("notes:对方")
    || !receiptSummary?.conflictResolutionText?.includes("GitHub Remote Manual Merge")
    || receiptSummary?.conflictResolutionText?.includes("record_desktop_")
    || !receiptSummary?.displayLabel?.includes("合并结果")
  ) {
    throw new Error(`Expected mobile sync receipt summary to show field-level merge results: ${JSON.stringify(receiptSummary)}`);
  }

  const mobileMergedVault = await readVault(terminalFiles[1]);
  const mergedNotes = findField(findRecordById(mobileMergedVault, githubRecord.id), "notes");
  if (mergedNotes.valueCipher !== desktopRemoteNotes.valueCipher) {
    throw new Error("Expected mobile vault notes field to be replaced with the selected remote field");
  }
  const mergedRecord = findRecordById(mobileMergedVault, githubRecord.id);
  if (mergedRecord.title !== "GitHub Remote Manual Merge") {
    throw new Error("Expected mobile vault title to be replaced with the selected remote-only title field");
  }

  console.log("Manual merge vault smoke test passed.");
  console.log(JSON.stringify({
    recordId: githubRecord.id,
    conflictId: previewConflict.id,
    resolvedConflicts: autoSync.targetReceipt.resolvedConflicts,
    receiverConfirmedRequest: true,
    receiptDisplayLabel: receiptSummary.displayLabel,
    metadataFields: previewConflict.fields.filter((field) => field.key === "title").map((field) => field.side),
    desktopDevice: desktopInitial.vault.deviceId,
    mobileDevice: mobileInitial.runtime.deviceId
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
    throw new Error(`GET ${url} failed with ${response.status}`);
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

async function trustDesktopAndPhone(desktopBaseUrl, mobileBaseUrl, mobileDeviceId) {
  const desktopPairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  const mobileSummary = await fetchJson(`${mobileBaseUrl}/api/sync/summary`);
  const remotePairingPayload = createRemotePairingPayload(mobileSummary.device, mobileBaseUrl, "manual_merge_phone");
  const verification = sync.createPairingVerification(desktopPairing.pairingPayload, remotePairingPayload);
  const desktopTrust = await postJson(`${desktopBaseUrl}/api/pairing/confirm`, {
    localSessionId: desktopPairing.pairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode
  });
  if (!desktopTrust.ok) {
    throw new Error("Expected desktop to trust phone before manual merge sync");
  }
  const phoneTrust = await postJson(`${mobileBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  if (!phoneTrust.ok) {
    throw new Error("Expected phone to trust desktop before manual merge sync");
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

function findRecordById(vault, recordId) {
  const record = vault.records.find((item) => item.id === recordId);
  if (!record) {
    throw new Error(`Record not found: ${recordId}`);
  }
  return record;
}

function findField(record, key) {
  const field = record.fields.find((item) => item.key === key);
  if (!field) {
    throw new Error(`Field not found: ${key}`);
  }
  return field;
}
