import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "terminal-shells-desktop.vault-snapshot.json",
  "terminal-shells-mobile.vault-snapshot.json",
  "terminal-shells-tablet.vault-snapshot.json",
  "terminal-shells-desktop.runtime-state.json",
  "terminal-shells-mobile.runtime-state.json",
  "terminal-shells-tablet.runtime-state.json",
  "terminal-shells-desktop.device-identity.json",
  "terminal-shells-mobile.device-identity.json",
  "terminal-shells-tablet.device-identity.json"
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

const desktop = await import("../apps/desktop/scripts/dev-server.mjs");
const mobile = await import("../apps/mobile/scripts/dev-server.mjs");
const tablet = await import("../apps/tablet/scripts/dev-server.mjs");
const sync = await import("../packages/sync-core/src/index.ts");
const terminalPreviews = await import("./start-terminal-previews.mjs");

const servers = [
  { key: "desktop", server: desktop.createDesktopShellServer() },
  { key: "mobile", server: mobile.createMobileShellServer() },
  { key: "tablet", server: tablet.createTabletShellServer() }
];

const running = [];

try {
  for (const item of servers) {
    await new Promise((resolve) => item.server.listen(0, "127.0.0.1", resolve));
    const address = item.server.address();
    running.push({
      key: item.key,
      server: item.server,
      baseUrl: `http://127.0.0.1:${address.port}`
    });
  }

  const states = {};
  for (const item of running) {
    const status = await fetchJson(`${item.baseUrl}/api/status`);
    const appState = await fetchJson(`${item.baseUrl}/api/app-state`);
    states[item.key] = { status, appState, baseUrl: item.baseUrl };
  }

  assertTerminal(states.desktop, {
    key: "desktop",
    product: "LoginTo desktop shell",
    minRecords: 4
  });
  assertTerminal(states.mobile, {
    key: "mobile",
    product: "LoginTo mobile shell",
    minRecords: 3
  });
  assertTerminal(states.tablet, {
    key: "tablet",
    product: "LoginTo tablet shell",
    minRecords: 4
  });

  if (!states.desktop.appState.sync || !states.mobile.appState.pairingPreview || !states.tablet.appState.syncPanel) {
    throw new Error("Expected all terminal shells to expose sync-facing preview state");
  }

  await trustTerminalPeers(states);

  const localOnlyTitle = `Local Only Terminal Smoke ${Date.now()}`;
  const created = await postJson(`${states.mobile.baseUrl}/api/records`, {
    type: "account",
    title: localOnlyTitle,
    username: "shared-smoke",
    password: "local-only",
    url: "https://local.test",
    notes: "Created from the phone shell and must stay in the phone vault until a real sync exchange is confirmed."
  });
  if (!created.ok) {
    throw new Error("Expected mobile shell to create a local-only vault record");
  }
  const acceptedOcrFieldKeys = states.mobile.appState.capturePreview.extractedFields
    .filter((field) => ["member_name", "member_id", "expires_at"].includes(field.key))
    .map((field) => field.key);
  const ocrTitle = `Terminal OCR Attachment ${Date.now()}`;
  const ocrRecord = await postJson(`${states.mobile.baseUrl}/api/ocr/commit`, {
    acceptedType: "membership",
    acceptedFieldKeys: acceptedOcrFieldKeys,
    editedFields: {
      member_name: ocrTitle
    },
    rejectedFieldKeys: states.mobile.appState.capturePreview.extractedFields
      .map((field) => field.key)
      .filter((key) => !acceptedOcrFieldKeys.includes(key)),
    createReminder: true
  });
  if (!ocrRecord.ok || ocrRecord.record.attachments !== 1 || !ocrRecord.record.attachmentIds?.[0]) {
    throw new Error(`Expected phone OCR commit to create a record with one encrypted attachment: ${JSON.stringify(ocrRecord)}`);
  }
  const afterLocalWrite = {
    desktop: await fetchJson(`${states.desktop.baseUrl}/api/app-state`),
    mobile: await fetchJson(`${states.mobile.baseUrl}/api/app-state`),
    tablet: await fetchJson(`${states.tablet.baseUrl}/api/app-state`)
  };
  if (!containsRecordTitle(afterLocalWrite.mobile, localOnlyTitle)) {
    throw new Error(`Expected mobile shell to read its own local record: ${localOnlyTitle}`);
  }
  for (const key of ["desktop", "tablet"]) {
    if (containsRecordTitle(afterLocalWrite[key], localOnlyTitle)) {
      throw new Error(`Expected ${key} shell not to see unsynced phone-local record: ${localOnlyTitle}`);
    }
  }
  const directPush = await postJsonAllowFailure(`${states.mobile.baseUrl}/api/sync/push`, {
    desktopBaseUrl: states.desktop.baseUrl,
    desktopDeviceId: states.desktop.appState.vault.deviceId
  });
  if (directPush.ok || !/confirmation/i.test(directPush.text)) {
    throw new Error("Expected direct phone sync push to require a confirmation preview first");
  }
  let mobilePreview = await postJson(`${states.mobile.baseUrl}/api/sync/preview`, {
    desktopBaseUrl: states.desktop.baseUrl,
    desktopDeviceId: states.desktop.appState.vault.deviceId
  });
  if (!mobilePreview.ok || !mobilePreview.confirmation?.id || mobilePreview.confirmation.preview.sendChanges < 1) {
    throw new Error("Expected phone sync preview to create a pending confirmation with a change summary");
  }
  assertRecordLevelPreview(mobilePreview.confirmation, {
    expectedSendTitle: localOnlyTitle,
    forbidden: ["local-only", "apple-secret-2026", "6225 8800 0000 0826", "valueCipher"]
  });
  const driftTitle = `Preview Drift Terminal Smoke ${Date.now()}`;
  await postJson(`${states.mobile.baseUrl}/api/records`, {
    type: "account",
    title: driftTitle,
    username: "preview-drift",
    password: "drift-secret",
    url: "https://drift.test",
    notes: "Created after preview and must force a fresh confirmation."
  });
  const staleMobilePush = await postJsonAllowFailure(`${states.mobile.baseUrl}/api/sync/push`, {
    desktopBaseUrl: states.desktop.baseUrl,
    desktopDeviceId: states.desktop.appState.vault.deviceId,
    confirmationId: mobilePreview.confirmation.id
  });
  assertPreviewDriftFailure(staleMobilePush, "phone -> desktop stale confirmation");
  mobilePreview = await postJson(`${states.mobile.baseUrl}/api/sync/preview`, {
    desktopBaseUrl: states.desktop.baseUrl,
    desktopDeviceId: states.desktop.appState.vault.deviceId
  });
  const syncPush = await postJson(`${states.mobile.baseUrl}/api/sync/push`, {
    desktopBaseUrl: states.desktop.baseUrl,
    desktopDeviceId: states.desktop.appState.vault.deviceId,
    confirmationId: mobilePreview.confirmation.id
  });
  if (!syncPush.ok || syncPush.sentChanges < 1 || syncPush.desktopReceipt.appliedChanges < 1) {
    throw new Error("Expected phone sync push to send changes and desktop to apply them");
  }
  const mobileReplay = await postJsonAllowFailure(`${states.mobile.baseUrl}/api/sync/push`, {
    desktopBaseUrl: states.desktop.baseUrl,
    desktopDeviceId: states.desktop.appState.vault.deviceId,
    confirmationId: mobilePreview.confirmation.id
  });
  assertConsumedConfirmationReplay(mobileReplay, "phone -> desktop confirmation replay", "confirmed");
  assertEncryptedTransportPackage(syncPush.transportPackage, "phone -> desktop");
  const desktopAfterSync = await fetchJson(`${states.desktop.baseUrl}/api/app-state`);
  if (desktopAfterSync.sync?.lastReceipt?.packageId !== syncPush.packageId) {
    throw new Error("Expected desktop app-state to expose the latest sync receipt");
  }
  assertCompleteSyncReceipt(desktopAfterSync.sync.lastReceipt, "desktop incoming phone sync");
  assertRecentSyncReceipts(desktopAfterSync.sync.recentReceipts, "desktop incoming phone sync audit log");
  const desktopOcrRecord = findRecordByTitle(desktopAfterSync, ocrTitle);
  assertRecordAttachmentMetadata(desktopOcrRecord, ocrRecord.record.attachmentIds[0], "desktop synced OCR record");

  let desktopToMobilePreview = await postJson(`${states.desktop.baseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: states.mobile.baseUrl,
    targetDeviceId: states.mobile.appState.runtime.deviceId
  });
  if (!desktopToMobilePreview.ok || !desktopToMobilePreview.confirmation?.id) {
    throw new Error("Expected desktop-to-phone preview to create a confirmation");
  }
  assertRecordLevelPreview(desktopToMobilePreview.confirmation, {
    expectedSendTitle: "GitHub",
    forbidden: ["demo-secret-2026", "ABCD-EFGH-IJKL", "6225 8800 0000 0826", "valueCipher"]
  });
  await postJson(`${states.desktop.baseUrl}/api/records`, {
    type: "membership",
    title: `Desktop Preview Drift ${Date.now()}`,
    memberId: "DRIFT-DESKTOP",
    level: "Gold",
    expiresAt: "2027-01-01",
    notes: "Created after desktop preview and must require a fresh confirmation."
  });
  const staleDesktopToMobile = await postJsonAllowFailure(`${states.desktop.baseUrl}/api/sync/push`, {
    targetKind: "phone",
    targetBaseUrl: states.mobile.baseUrl,
    targetDeviceId: states.mobile.appState.runtime.deviceId,
    confirmationId: desktopToMobilePreview.confirmation.id
  });
  assertPreviewDriftFailure(staleDesktopToMobile, "desktop -> phone stale confirmation");
  desktopToMobilePreview = await postJson(`${states.desktop.baseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: states.mobile.baseUrl,
    targetDeviceId: states.mobile.appState.runtime.deviceId
  });
  const desktopToMobile = await postJson(`${states.desktop.baseUrl}/api/sync/push`, {
    targetKind: "phone",
    targetBaseUrl: states.mobile.baseUrl,
    targetDeviceId: states.mobile.appState.runtime.deviceId,
    confirmationId: desktopToMobilePreview.confirmation.id
  });
  if (!desktopToMobile.ok || desktopToMobile.sentChanges < 1 || desktopToMobile.targetReceipt.appliedChanges < 1) {
    throw new Error(`Expected desktop sync push to send changes to the phone shell: ${JSON.stringify(desktopToMobile)}`);
  }
  const desktopToMobileReplay = await postJsonAllowFailure(`${states.desktop.baseUrl}/api/sync/push`, {
    targetKind: "phone",
    targetBaseUrl: states.mobile.baseUrl,
    targetDeviceId: states.mobile.appState.runtime.deviceId,
    confirmationId: desktopToMobilePreview.confirmation.id
  });
  assertConsumedConfirmationReplay(desktopToMobileReplay, "desktop -> phone confirmation replay", "confirmed");
  assertEncryptedTransportPackage(desktopToMobile.transportPackage, "desktop -> phone");
  const mobileAfterDesktopPush = await fetchJson(`${states.mobile.baseUrl}/api/app-state`);
  if (mobileAfterDesktopPush.syncPanel?.lastReceipt?.packageId !== desktopToMobile.packageId) {
    throw new Error("Expected mobile app-state to expose the latest desktop sync receipt");
  }
  assertCompleteSyncReceipt(mobileAfterDesktopPush.syncPanel.lastReceipt, "mobile incoming desktop sync");
  assertRecentSyncReceipts(mobileAfterDesktopPush.syncPanel.recentReceipts, "mobile incoming desktop sync audit log");

  const desktopToTabletPreview = await postJson(`${states.desktop.baseUrl}/api/sync/preview`, {
    targetKind: "tablet",
    targetBaseUrl: states.tablet.baseUrl,
    targetDeviceId: states.tablet.appState.runtime.deviceId
  });
  if (!desktopToTabletPreview.ok || !desktopToTabletPreview.confirmation?.id) {
    throw new Error("Expected desktop-to-tablet preview to create a confirmation");
  }
  assertRecordLevelPreview(desktopToTabletPreview.confirmation, {
    expectedSendTitle: "GitHub",
    forbidden: ["demo-secret-2026", "ABCD-EFGH-IJKL", "6225 8800 0000 0826", "valueCipher"]
  });
  const desktopToTablet = await postJson(`${states.desktop.baseUrl}/api/sync/push`, {
    targetKind: "tablet",
    targetBaseUrl: states.tablet.baseUrl,
    targetDeviceId: states.tablet.appState.runtime.deviceId,
    confirmationId: desktopToTabletPreview.confirmation.id
  });
  if (!desktopToTablet.ok || desktopToTablet.sentChanges < 1 || desktopToTablet.targetReceipt.appliedChanges < 1) {
    throw new Error(`Expected desktop sync push to send changes to the tablet shell: ${JSON.stringify(desktopToTablet)}`);
  }
  const desktopToTabletReplay = await postJsonAllowFailure(`${states.desktop.baseUrl}/api/sync/push`, {
    targetKind: "tablet",
    targetBaseUrl: states.tablet.baseUrl,
    targetDeviceId: states.tablet.appState.runtime.deviceId,
    confirmationId: desktopToTabletPreview.confirmation.id
  });
  assertConsumedConfirmationReplay(desktopToTabletReplay, "desktop -> tablet confirmation replay", "confirmed");
  assertEncryptedTransportPackage(desktopToTablet.transportPackage, "desktop -> tablet");
  const tabletAfterDesktopPush = await fetchJson(`${states.tablet.baseUrl}/api/app-state`);
  if (tabletAfterDesktopPush.syncPanel?.lastReceipt?.packageId !== desktopToTablet.packageId) {
    throw new Error("Expected tablet app-state to expose the latest desktop sync receipt");
  }
  assertCompleteSyncReceipt(tabletAfterDesktopPush.syncPanel.lastReceipt, "tablet incoming desktop sync");
  assertRecentSyncReceipts(tabletAfterDesktopPush.syncPanel.recentReceipts, "tablet incoming desktop sync audit log");
  const tabletOcrRecord = findRecordByTitle(tabletAfterDesktopPush, ocrTitle);
  assertRecordAttachmentMetadata(tabletOcrRecord, ocrRecord.record.attachmentIds[0], "tablet synced OCR record");

  const conflictPorts = Object.fromEntries(
    running.map((item) => [item.key, Number(new URL(item.baseUrl).port)])
  );
  const reusedPreviews = await terminalPreviews.startTerminalPreviews({
    ports: conflictPorts,
    fallbackSpan: 3,
    print: false
  });
  try {
    for (const terminal of reusedPreviews.terminals) {
      if (terminal.status !== "reused") {
        throw new Error(`Expected ${terminal.name} occupied preview port to be reused, got ${terminal.status}`);
      }
    }
  } finally {
    await terminalPreviews.stopTerminalPreviews(reusedPreviews);
  }

  const terminalKinds = [
    states.desktop.appState.vault.deviceId,
    states.mobile.appState.runtime.deviceId,
    states.tablet.appState.runtime.deviceId
  ];

  console.log("Terminal shell smoke test passed.");
  console.log(
    JSON.stringify(
      {
        desktop: summarizeTerminal(states.desktop),
        mobile: summarizeTerminal(states.mobile),
        tablet: summarizeTerminal(states.tablet),
        localOnlyRecord: localOnlyTitle,
        syncPush: {
          confirmationRequired: true,
          previewSendChanges: mobilePreview.confirmation.preview.sendChanges,
          sentChanges: syncPush.sentChanges,
          appliedChanges: syncPush.desktopReceipt.appliedChanges
        },
        desktopPush: {
          mobileApplied: desktopToMobile.targetReceipt.appliedChanges,
          mobileConflicts: desktopToMobile.targetReceipt.conflicts,
          tabletApplied: desktopToTablet.targetReceipt.appliedChanges,
          tabletConflicts: desktopToTablet.targetReceipt.conflicts
        },
        terminalDevices: terminalKinds,
        reusedTerminals: reusedPreviews.terminals.length
      },
      null,
      2
    )
  );
} finally {
  await Promise.all(running.map((item) => closeServer(item.server)));
}

function assertTerminal(state, input) {
  if (state.status.product !== input.product) {
    throw new Error(`Expected ${input.key} product ${input.product}, got ${state.status.product}`);
  }
  const records = state.appState.vault?.records ?? state.appState.runtime?.records ?? 0;
  if (records < input.minRecords) {
    throw new Error(`Expected ${input.key} to expose at least ${input.minRecords} records, got ${records}`);
  }
  if (!state.status.capabilities.some((capability) => /local|runtime|vault/i.test(capability))) {
    throw new Error(`Expected ${input.key} status to advertise local/runtime/vault capability`);
  }
}

function summarizeTerminal(state) {
  return {
    baseUrl: state.baseUrl,
    product: state.status.product,
    records: state.appState.vault?.records ?? state.appState.runtime?.records,
    dueReminders: state.appState.vault?.dueReminders ?? state.appState.runtime?.dueReminders,
    trustedDevices: state.appState.sync?.trustedDevices ?? state.appState.runtime?.trustedDevices,
    persistedVault: state.appState.storage?.persistedVault ?? state.appState.vault?.vaultPath !== undefined,
    persistedRuntimeState: state.appState.storage?.persistedRuntimeState ?? state.appState.vault?.runtimeStatePath !== undefined
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${url} (${response.status})`);
  }
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${url} (${response.status}) ${await response.text()}`);
  }
  return response.json();
}

async function postJsonAllowFailure(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text,
    json: response.ok && text ? JSON.parse(text) : undefined
  };
}

function containsRecordTitle(value, title) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value.title === title) {
    return true;
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child) && child.some((item) => containsRecordTitle(item, title))) {
      return true;
    }
    if (!Array.isArray(child) && containsRecordTitle(child, title)) {
      return true;
    }
  }
  return false;
}

function findRecordByTitle(value, title) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  if (value.title === title) {
    return value;
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findRecordByTitle(item, title);
        if (found) return found;
      }
    } else {
      const found = findRecordByTitle(child, title);
      if (found) return found;
    }
  }
  return undefined;
}

function assertRecordAttachmentMetadata(record, attachmentId, label) {
  if (
    !record
    || record.attachmentCount !== 1
    || record.attachments?.[0]?.id !== attachmentId
    || !record.attachments?.[0]?.encryptedBlobPath?.includes("attachments/")
    || record.attachments?.[0]?.encrypted !== true
  ) {
    throw new Error(`Expected ${label} to expose encrypted attachment metadata: ${JSON.stringify(record)}`);
  }
}

function assertRecordLevelPreview(confirmation, input) {
  if (!Array.isArray(confirmation.recordsToSend) || !Array.isArray(confirmation.recordsToReceive) || !Array.isArray(confirmation.conflicts)) {
    throw new Error("Expected sync confirmation to include record-level send/receive/conflict arrays");
  }
  if (!confirmation.recordsToSend.some((item) => item.record?.title === input.expectedSendTitle)) {
    throw new Error(`Expected sync confirmation to include send record: ${input.expectedSendTitle}`);
  }
  const serialized = JSON.stringify(confirmation);
  for (const forbidden of input.forbidden) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Sync confirmation leaked sensitive preview content: ${forbidden}`);
    }
  }
  for (const item of confirmation.recordsToSend) {
    if (!item.record?.title || !item.record?.type || !Number.isFinite(item.record?.fieldCount)) {
      throw new Error("Expected each send preview record to expose safe title/type/field counts");
    }
  }
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

async function trustTerminalPeers(states) {
  const desktopPairing = await postJson(`${states.desktop.baseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  const mobileSummary = await fetchJson(`${states.mobile.baseUrl}/api/sync/summary`);
  const tabletSummary = await fetchJson(`${states.tablet.baseUrl}/api/sync/summary`);
  const desktopSummary = await fetchJson(`${states.desktop.baseUrl}/api/sync/summary`);
  const desktopTrustsPhone = await trustDesktopWithRemotePayload(
    states.desktop.baseUrl,
    desktopPairing.pairingPayload,
    mobileSummary.device,
    "pairing_phone_terminal_smoke"
  );
  if (!desktopTrustsPhone.ok) {
    throw new Error("Expected desktop shell to trust the phone before sync");
  }
  const desktopTrustsTablet = await trustDesktopWithRemotePayload(
    states.desktop.baseUrl,
    desktopPairing.pairingPayload,
    tabletSummary.device,
    "pairing_tablet_terminal_smoke"
  );
  if (!desktopTrustsTablet.ok) {
    throw new Error("Expected desktop shell to trust the tablet before sync");
  }
  const phoneTrustsDesktop = await postJson(`${states.mobile.baseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  if (!phoneTrustsDesktop.ok) {
    throw new Error("Expected phone shell to trust the desktop before sync");
  }
  const tabletTrustsDesktop = await postJson(`${states.tablet.baseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  if (!tabletTrustsDesktop.ok) {
    throw new Error("Expected tablet shell to trust the desktop before sync");
  }
}

async function trustDesktopWithRemotePayload(desktopBaseUrl, localPairingPayload, device, sessionId) {
  const remotePairingPayload = sync.createPairingPayload({
    device,
    sessionId,
    localEndpoint: `http://127.0.0.1:${device.kind === "tablet" ? 4178 : 4177}`,
    ttlSeconds: 31_536_000,
    now: () => "2026-12-20T09:00:00.000Z"
  });
  const verification = sync.createPairingVerification(localPairingPayload, remotePairingPayload);
  return postJson(`${desktopBaseUrl}/api/pairing/confirm`, {
    localSessionId: localPairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode,
    ttlSeconds: 31_536_000
  });
}

function assertEncryptedTransportPackage(transportPackage, label) {
  if (transportPackage?.protocol !== "loginto-encrypted-sync-exchange-v1") {
    throw new Error(`Expected ${label} sync to use encrypted package transport`);
  }
  if (transportPackage.encrypted !== true || transportPackage.plaintextExchangeIncluded !== false) {
    throw new Error(`Expected ${label} sync transport to omit plaintext exchange packages`);
  }
  if (!Number.isFinite(transportPackage.ciphertextBytes) || transportPackage.ciphertextBytes < 1) {
    throw new Error(`Expected ${label} sync transport to include ciphertext bytes`);
  }
}

function assertCompleteSyncReceipt(receipt, label) {
  const requiredStringFields = ["peerDeviceId", "peerName", "syncedAt", "status"];
  for (const field of requiredStringFields) {
    if (typeof receipt?.[field] !== "string" || !receipt[field]) {
      throw new Error(`Expected ${label} receipt to include ${field}`);
    }
  }
  for (const field of ["sentCount", "receivedCount", "conflictCount"]) {
    if (!Number.isFinite(receipt[field]) || receipt[field] < 0) {
      throw new Error(`Expected ${label} receipt to include numeric ${field}`);
    }
  }
  if (receipt.status !== "success" && receipt.status !== "failed") {
    throw new Error(`Expected ${label} receipt status to be success or failed`);
  }
}

function assertRecentSyncReceipts(receipts, label) {
  if (!Array.isArray(receipts) || receipts.length < 1) {
    throw new Error(`Expected ${label} to expose recent sync receipts`);
  }
  assertCompleteSyncReceipt(receipts[0], label);
  if (receipts.length > 5) {
    throw new Error(`Expected ${label} to keep the visible audit log concise`);
  }
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
