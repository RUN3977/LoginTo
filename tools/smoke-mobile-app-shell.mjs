import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { resetMobileShellRuntimeForTests } from "../apps/mobile/scripts/app-state.mjs";
import { createMobileShellServer } from "../apps/mobile/scripts/dev-server.mjs";
const sync = await import("../packages/sync-core/src/index.ts");

const vaultPath = join(process.cwd(), ".tmp", "mobile-app-shell-smoke.vault-snapshot.json");
const runtimeStatePath = join(process.cwd(), ".tmp", "mobile-app-shell-smoke.runtime-state.json");
process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH = vaultPath;
process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH = runtimeStatePath;
await rm(vaultPath, { force: true });
await rm(`${vaultPath}.tmp`, { force: true });
await rm(`${vaultPath}.sync-deletions.json`, { force: true });
await rm(`${vaultPath}.sync-deletions.json.tmp`, { force: true });
await rm(runtimeStatePath, { force: true });
await rm(`${runtimeStatePath}.tmp`, { force: true });
resetMobileShellRuntimeForTests();

const htmlPath = join(process.cwd(), "apps/mobile/prototype/index.html");
const html = readFileSync(htmlPath, "utf8");

const requiredSnippets = [
  "LoginTo 手机保险库",
  "新增记录",
  "最近记录",
  "编辑选中记录",
  "提醒中心",
  "data-reminder-popup",
  "data-reminder-popup-action=\"complete\"",
  "data-reminder-popup-action=\"snooze\"",
  "data-reminder-popup-action=\"dismiss\"",
  "data-reminder-tabs",
  "data-reminder-list",
  "data-reminder-action=\"complete\"",
  "data-reminder-action=\"snooze\"",
  "data-reminder-action=\"dismiss\"",
  "拍照自动整理",
  "扫码配对",
  "data-capture-form",
  "data-capture-title",
  "data-capture-meta",
  "data-ocr-fields",
  "acceptedFieldKeys",
  "editedField:",
  "data-capture-summary",
  "data-capture-attachment-note",
  "data-selected-attachment-summary",
  "data-selected-attachment-list",
  "data-attachment-action=\"remove\"",
  "data-capture-reminder-note",
  "createReminder",
  "data-open-sheet=\"pair\"",
  "data-open-sheet=\"capture\"",
  "data-action=\"scan-pairing\"",
  "data-mobile-pairing-payload",
  "data-mobile-pairing-code",
  "data-mobile-pairing-image",
  "data-mobile-pairing-input-status",
  "BarcodeDetector",
  "data-action=\"commit-capture\"",
  "data-action=\"delete-record\"",
  "data-action=\"sync-push\"",
  "data-sync-preview",
  "data-sync-records",
  "data-sync-receipt",
  "data-mobile-sync-audit-log",
  "data-mobile-sync-recovery-action",
  "renderMobileSyncAuditLog",
  "data-candidate-action",
  "data-candidate-reason",
  "data-sync-review-panel",
  "data-mobile-sync-review-records",
  "data-mobile-sync-review-trust",
  "data-mobile-sync-review-expires",
  "同步摘要已过期",
  "data-mobile-sync-review-peer-url",
  "data-mobile-sync-review-fingerprint",
  "data-mobile-sync-review-public-network",
  "data-mobile-sync-review-confirm",
  "openMobileSyncReviewPanel",
  "formatSyncReviewTrust",
  "本地存储",
  "data-storage-copy",
  "data-storage-vault-path",
  "data-storage-runtime-path",
  "data-device-copy",
  "data-mobile-security-panel",
  "data-mobile-security-lock-state",
  "data-mobile-security-second-unlock",
  "data-mobile-security-copy-clear",
  "renderMobileSecurityPanel",
  "persistedRuntimeState",
  "collectConflictDecisions",
  "data-conflict-panel",
  "data-mobile-conflict-list",
  "data-mobile-conflict-confirm",
  "data-conflict-resolution",
  "data-activity-log",
  "logAction",
  "/api/app-state",
  "/api/records",
  "/api/attachments",
  "/api/reminders/action",
  "/api/ocr/commit",
  "/api/pairing/scan",
  "/api/pairing/trust",
  "trustMobilePairing",
  "/api/sync/push",
  "/api/sync/preview",
  "data-stat=\"records\""
];

for (const snippet of requiredSnippets) {
  if (!html.includes(snippet)) {
    throw new Error(`Mobile app shell prototype is missing snippet: ${snippet}`);
  }
}

const server = createMobileShellServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const status = await fetchJson(`${baseUrl}/api/status`);
  if (!status.capabilities.includes("runtime-backed app-state API")) {
    throw new Error("Expected mobile status endpoint to advertise runtime-backed app-state API");
  }
  if (status.deviceContainer?.kind !== "phone" || status.deviceContainer.publicNetworkLogin !== false) {
    throw new Error("Expected mobile status to expose a local-only phone device container");
  }

  const appState = await fetchJson(`${baseUrl}/api/app-state`);
  if (appState.deviceContainer?.formFactor !== "phone") {
    throw new Error("Expected mobile app-state to expose phone device container profile");
  }
  if (!appState.storage?.vaultPath?.includes(".tmp") || !appState.storage?.runtimeStatePath?.includes(".tmp")) {
    throw new Error("Expected mobile app-state to expose local storage paths");
  }
  if (!appState.deviceContainer.capabilities.some((capability) => capability.id === "camera-capture")) {
    throw new Error("Expected mobile device container to expose camera capture capability");
  }
  if (!appState.deviceContainer.syncTransports.includes("local-network")) {
    throw new Error("Expected mobile device container to include local-network sync transport");
  }
  if (appState.deviceContainer.transportPlan?.publicNetworkLogin !== false) {
    throw new Error("Expected mobile device container transport plan to reject public-network login");
  }
  if (appState.syncPanel.discovery?.transportPlan?.recommendedTransport !== "local-network") {
    throw new Error("Expected mobile discovery to expose a local-network transport plan");
  }
  if (appState.runtime.records < 3) {
    throw new Error(`Expected seeded mobile runtime records, got ${appState.runtime.records}`);
  }
  if (appState.security?.lockState !== "unlocked" || appState.security?.copyClearSeconds <= 0 || appState.security?.autoLockSeconds <= 0) {
    throw new Error("Expected mobile app-state to expose vault security status");
  }
  if (appState.viewState.stats.dueAlerts < 1) {
    throw new Error("Expected mobile app-state to include at least one due alert");
  }
  if (!appState.reminderCenter?.items?.length || appState.reminderCenter.pending.length < 1) {
    throw new Error("Expected mobile app-state to expose a reminder center with pending items");
  }
  if (!appState.reminderCenter.items.some((item) => item.popupTitle?.includes("提醒") && item.popupBody?.includes("到期/触发时间"))) {
    throw new Error("Expected mobile reminder center to expose popup title and body content");
  }

  const created = await postJson(`${baseUrl}/api/records`, {
    type: "account",
    title: "Smoke Real Account",
    username: "smoke-user",
    password: "smoke-password",
    url: "https://example.test",
    notes: "Created by the mobile CRUD smoke."
  });
  if (!created.ok || created.appState.runtime.records !== appState.runtime.records + 1) {
    throw new Error("Expected mobile record creation API to persist a real record");
  }
  const persistedVaultAfterCreate = JSON.parse(readFileSync(vaultPath, "utf8"));
  const persistedCreatedRecord = persistedVaultAfterCreate.records.find((record) => record.id === created.record.id);
  const persistedCreatedPassword = persistedCreatedRecord?.fields.find((field) => field.key === "password");
  if (!persistedCreatedPassword?.valueCipher?.startsWith("loginto-field-cipher-v1:") || persistedCreatedPassword.valueCipher.includes("smoke-password")) {
    throw new Error("Expected mobile created password to be stored as encrypted field cipher");
  }

  const updated = await patchJson(`${baseUrl}/api/records`, {
    recordId: created.record.id,
    title: "Smoke Real Account Updated",
    notes: "Updated by the mobile CRUD smoke."
  });
  if (!updated.ok || updated.record.title !== "Smoke Real Account Updated") {
    throw new Error("Expected mobile record update API to persist title/notes");
  }

  const alertId = appState.reminderCenter.pending[0].alertId;
  const reminderAction = await postJson(`${baseUrl}/api/reminders/action`, {
    action: "complete",
    alertId
  });
  if (reminderAction.delivery.status !== "completed") {
    throw new Error(`Expected completed mobile reminder action, got ${reminderAction.delivery.status}`);
  }
  const snooze = await postJson(`${baseUrl}/api/reminders/action`, {
    action: "snooze",
    alertId,
    snoozedUntil: "2026-06-13T10:41:00.000Z"
  });
  if (snooze.delivery.status !== "snoozed" || snooze.delivery.snoozedUntil !== "2026-06-13T10:41:00.000Z") {
    throw new Error("Expected mobile reminder center to support snooze action");
  }
  const dismiss = await postJson(`${baseUrl}/api/reminders/action`, {
    action: "dismiss",
    alertId
  });
  if (dismiss.delivery.status !== "dismissed") {
    throw new Error("Expected mobile reminder center to support dismiss action");
  }

  const pairingScan = await postJson(`${baseUrl}/api/pairing/scan`, {});
  if (pairingScan.deviceName !== "Zhang Desktop" || !pairingScan.endpoint) {
    throw new Error("Expected mobile pairing scan API to decode the desktop target");
  }
  const missingCodeTrust = await postJsonAllowFailure(`${baseUrl}/api/pairing/trust`, {});
  if (missingCodeTrust.ok || !missingCodeTrust.text.includes("six-digit verification code")) {
    throw new Error(`Expected mobile pairing trust to require a verification code: ${missingCodeTrust.text}`);
  }
  const wrongCodeTrust = await postJsonAllowFailure(`${baseUrl}/api/pairing/trust`, {
    confirmedCode: "000000"
  });
  if (wrongCodeTrust.ok || !wrongCodeTrust.text.includes("verification code does not match")) {
    throw new Error(`Expected mobile pairing trust to reject a wrong verification code: ${wrongCodeTrust.text}`);
  }
  const publicEndpointQr = createDesktopPairingQrPayload("https://public.example.com:4173");
  const publicEndpointTrust = await postJsonAllowFailure(`${baseUrl}/api/pairing/trust`, {
    payloadText: publicEndpointQr.payloadText,
    confirmedCode: publicEndpointQr.verificationCode
  });
  if (publicEndpointTrust.ok || !publicEndpointTrust.text.includes("public network sync is not allowed")) {
    throw new Error(`Expected mobile pairing trust to reject public-network endpoints: ${publicEndpointTrust.text}`);
  }
  const pairingTrust = await postJson(`${baseUrl}/api/pairing/trust`, {
    payloadText: pairingScan.qrPayloadText,
    confirmedCode: pairingScan.previewVerificationCode
  });
  if (pairingTrust.trustedDevices !== 1 || pairingTrust.trustedDevice.id !== pairingScan.deviceId) {
    throw new Error("Expected mobile pairing trust API to persist the scanned desktop target");
  }

  if (!Array.isArray(appState.capturePreview?.extractedFields) || appState.capturePreview.extractedFields.length < 3) {
    throw new Error("Expected mobile app-state to expose editable OCR extracted fields");
  }
  if (!appState.capturePreview.image?.encryptedBlobPath || !appState.capturePreview.originalImageKeptAsEncryptedAttachment) {
    throw new Error("Expected mobile app-state to expose encrypted image attachment metadata");
  }

  const acceptedFieldKeys = appState.capturePreview.extractedFields
    .filter((field) => ["member_name", "member_id", "expires_at"].includes(field.key))
    .map((field) => field.key);
  const ocrCommit = await postJson(`${baseUrl}/api/ocr/commit`, {
    acceptedType: "membership",
    acceptedFieldKeys,
    editedFields: {
      member_name: "Smoke Edited Lounge VIP"
    },
    rejectedFieldKeys: appState.capturePreview.extractedFields
      .map((field) => field.key)
      .filter((key) => !acceptedFieldKeys.includes(key)),
    createReminder: true
  });
  if (!ocrCommit.ok || ocrCommit.record.attachments !== 1 || ocrCommit.record.reminders !== 1) {
    throw new Error("Expected mobile OCR commit API to create a record with attachment and reminder");
  }
  const persistedVaultAfterOcr = JSON.parse(readFileSync(vaultPath, "utf8"));
  const persistedOcrRecord = persistedVaultAfterOcr.records.find((record) => record.id === ocrCommit.record.id);
  const persistedOcrNotes = persistedOcrRecord?.fields.find((field) => field.key === "notes");
  if (!persistedOcrNotes?.valueCipher?.startsWith("loginto-field-cipher-v1:") || persistedOcrNotes.valueCipher.includes(ocrCommit.record.attachmentIds?.[0])) {
    throw new Error("Expected mobile OCR attachment note to be stored as encrypted field cipher");
  }
  if (ocrCommit.record.title !== "Smoke Edited Lounge VIP") {
    throw new Error(`Expected OCR edited field value to become the committed title, got ${ocrCommit.record.title}`);
  }
  if (!ocrCommit.record.attachmentNames?.[0]?.includes("attachments/")) {
    throw new Error("Expected mobile OCR commit API to keep the original image as an encrypted attachment");
  }
  if (!ocrCommit.record.attachmentNote?.includes(ocrCommit.record.attachmentIds?.[0]) || !ocrCommit.record.attachmentNote.includes("加密附件")) {
    throw new Error("Expected mobile OCR commit API to write the image attachment into record notes");
  }
  const ocrRecordTile = ocrCommit.appState.viewState.recent.find((record) => record.id === ocrCommit.record.id);
  if (
    !ocrRecordTile
    || ocrRecordTile.attachmentCount !== 1
    || ocrRecordTile.attachments?.[0]?.id !== ocrCommit.record.attachmentIds[0]
    || !ocrRecordTile.attachments?.[0]?.encryptedBlobPath?.includes("attachments/")
    || !ocrRecordTile.notesPreview?.includes(ocrCommit.record.attachmentIds[0])
  ) {
    throw new Error(`Expected mobile app-state record tile to expose OCR attachment details: ${JSON.stringify(ocrRecordTile)}`);
  }
  if (ocrCommit.appState.runtime.records <= created.appState.runtime.records) {
    throw new Error("Expected mobile OCR commit API to increase runtime record count");
  }
  const removedAttachment = await deleteJson(`${baseUrl}/api/attachments`, {
    recordId: ocrCommit.record.id,
    attachmentId: ocrCommit.record.attachmentIds[0]
  });
  const attachmentRemovedTile = removedAttachment.appState.viewState.recent.find((record) => record.id === ocrCommit.record.id);
  if (!removedAttachment.ok || removedAttachment.record.attachments !== 0 || attachmentRemovedTile?.attachmentCount !== 0) {
    throw new Error("Expected mobile attachment removal API to remove the record attachment reference");
  }

  const deleted = await deleteJson(`${baseUrl}/api/records`, { recordId: created.record.id });
  if (!deleted.ok || deleted.deletedRecordId !== created.record.id) {
    throw new Error("Expected mobile record delete API to remove the created record");
  }

  resetMobileShellRuntimeForTests();
  const reloadedState = await fetchJson(`${baseUrl}/api/app-state`);
  if (reloadedState.runtime.records !== deleted.appState.runtime.records) {
    throw new Error("Expected mobile shell vault snapshot to survive runtime reload");
  }
  if (reloadedState.runtime.trustedDevices !== 1) {
    throw new Error("Expected mobile shell trusted devices to survive runtime reload");
  }
  if (!reloadedState.notificationState.deliveries.some((delivery) => delivery.status === "dismissed")) {
    throw new Error("Expected mobile shell reminder center state to survive runtime reload");
  }

  console.log("Mobile app shell smoke test passed.");
  console.log(
    JSON.stringify(
      {
        baseUrl,
        htmlBytes: html.length,
        runtimeRecords: appState.runtime.records,
        recordsAfterCreate: created.appState.runtime.records,
        updatedRecord: updated.record.title,
        deletedRecordId: deleted.deletedRecordId,
        recordsAfterOcrCommit: ocrCommit.appState.runtime.records,
        recordsAfterRuntimeReload: reloadedState.runtime.records,
        dueAlerts: appState.viewState.stats.dueAlerts,
        completedReminder: reminderAction.delivery.status,
        snoozedReminder: snooze.delivery.status,
        dismissedReminder: dismiss.delivery.status,
        scannedDevice: pairingScan.deviceName,
        trustedDevicesAfterReload: reloadedState.runtime.trustedDevices,
        deviceContainer: reloadedState.deviceContainer.kind,
        persistedVault: reloadedState.storage.persistedVault,
        persistedRuntimeState: reloadedState.storage.persistedRuntimeState,
        prototype: htmlPath
      },
      null,
      2
    )
  );
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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
    throw new Error(`Request failed: ${url} (${response.status})`);
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
    text: await response.text()
  };
}

async function patchJson(url, body) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${url} (${response.status})`);
  }
  return response.json();
}

async function deleteJson(url, body) {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${url} (${response.status})`);
  }
  return response.json();
}

function createDesktopPairingQrPayload(localEndpoint) {
  const pairingPayload = sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: "device_public_desktop_for_mobile_shell_smoke",
      name: "Public Desktop",
      kind: "desktop",
      publicKeyBase64: "mobile-public-endpoint-smoke-desktop-key",
      now: () => "2026-06-13T18:20:00.000Z"
    }),
    sessionId: "pairing_mobile_public_endpoint_smoke",
    localEndpoint,
    ttlSeconds: 31_536_000,
    now: () => "2026-06-13T18:20:00.000Z"
  });
  const qr = sync.encodePairingPayloadQr(pairingPayload);
  return {
    payloadText: qr.payloadText,
    verificationCode: createPreviewVerificationCode(JSON.stringify(pairingPayload))
  };
}

function createPreviewVerificationCode(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String(Math.abs(hash) % 1_000_000).padStart(6, "0");
}
