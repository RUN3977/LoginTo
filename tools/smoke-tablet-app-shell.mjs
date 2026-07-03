import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { resetTabletShellRuntimeForTests } from "../apps/tablet/scripts/app-state.mjs";
import { createTabletShellServer } from "../apps/tablet/scripts/dev-server.mjs";
const sync = await import("../packages/sync-core/src/index.ts");

const vaultPath = join(process.cwd(), ".tmp", "tablet-app-shell-smoke.vault-snapshot.json");
const runtimeStatePath = join(process.cwd(), ".tmp", "tablet-app-shell-smoke.runtime-state.json");
const deviceIdentityPath = join(process.cwd(), ".tmp", "tablet-app-shell-smoke.device-identity.json");
process.env.LOGINTO_TABLET_SHELL_VAULT_PATH = vaultPath;
process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH = runtimeStatePath;
process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH = deviceIdentityPath;
await rm(vaultPath, { force: true });
await rm(`${vaultPath}.tmp`, { force: true });
await rm(`${vaultPath}.sync-deletions.json`, { force: true });
await rm(`${vaultPath}.sync-deletions.json.tmp`, { force: true });
await rm(runtimeStatePath, { force: true });
await rm(`${runtimeStatePath}.tmp`, { force: true });
await rm(deviceIdentityPath, { force: true });
await rm(`${deviceIdentityPath}.tmp`, { force: true });
resetTabletShellRuntimeForTests();

const htmlPath = join(process.cwd(), "apps/tablet/prototype/index.html");
const html = readFileSync(htmlPath, "utf8");

const requiredSnippets = [
  "LoginTo 平板整理台",
  "data-storage-copy",
  "data-storage-vault-path",
  "data-storage-runtime-path",
  "data-action=\"trust-desktop\"",
  "data-action=\"review-confirm\"",
  "data-tablet-activity",
  "data-tablet-security-panel",
  "data-tablet-security-lock-state",
  "data-tablet-security-second-unlock",
  "data-tablet-security-copy-clear",
  "renderTabletSecurityPanel",
  "data-tablet-sync-receipt",
  "data-tablet-sync-review-trust",
  "data-tablet-sync-review-expires",
  "同步摘要已过期",
  "data-tablet-sync-review-peer-url",
  "data-tablet-sync-review-fingerprint",
  "data-tablet-sync-review-public-network",
  "data-tablet-sync-audit-log",
  "data-tablet-sync-recovery-action",
  "renderTabletSyncAuditLog",
  "formatSyncReviewTrust",
  "data-tablet-discovery-probes",
  "data-tablet-near-field-candidates",
  "data-action=\"discovery-scan\"",
  "data-candidate-action",
  "data-candidate-reason",
  "data-tablet-conflict-panel",
  "data-tablet-conflict-list",
  "data-conflict-resolution",
  "data-manual-merge-fields",
  "manual-merge",
  "data-tablet-record-form",
  "data-action=\"tablet-update-record\"",
  "data-action=\"tablet-delete-record\"",
  "data-attachment-action=\"remove\"",
  "/api/records",
  "/api/attachments",
  "data-notes-form",
  "提醒中心",
  "data-tablet-reminder-popup",
  "data-tablet-reminder-popup-action=\"complete\"",
  "data-tablet-reminder-popup-action=\"snooze\"",
  "data-tablet-reminder-popup-action=\"dismiss\"",
  "data-tablet-reminder-tabs",
  "data-tablet-reminder-list",
  "data-reminder-action=\"complete\"",
  "data-reminder-action=\"snooze\"",
  "data-reminder-action=\"dismiss\"",
  "/api/reminders/action",
  "logTabletAction",
  "/api/app-state",
  "/api/review/confirm",
  "/api/review/notes",
  "/api/pairing/trust",
  "data-tablet-pairing-payload",
  "data-tablet-pairing-code",
  "data-tablet-pairing-input-status",
  "/api/discovery/scan",
  "/api/discovery/resolve"
];

for (const snippet of requiredSnippets) {
  if (!html.includes(snippet)) {
    throw new Error(`Tablet app shell prototype is missing snippet: ${snippet}`);
  }
}

const server = createTabletShellServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const status = await fetchJson(`${baseUrl}/api/status`);
  if (!status.capabilities.includes("runtime-backed app-state API")) {
    throw new Error("Expected tablet status endpoint to advertise runtime-backed app-state API");
  }
  if (status.deviceContainer?.kind !== "tablet" || status.deviceContainer.publicNetworkLogin !== false) {
    throw new Error("Expected tablet status to expose a local-only tablet device container");
  }

  const appState = await fetchJson(`${baseUrl}/api/app-state`);
  if (appState.deviceContainer?.formFactor !== "tablet") {
    throw new Error("Expected tablet app-state to expose tablet device container profile");
  }
  if (!appState.storage?.vaultPath?.includes(".tmp") || !appState.storage?.runtimeStatePath?.includes(".tmp")) {
    throw new Error("Expected tablet app-state to expose local storage paths");
  }
  if (!appState.deviceContainer.capabilities.some((capability) => capability.id === "large-screen-review")) {
    throw new Error("Expected tablet device container to expose large-screen review capability");
  }
  if (!appState.deviceContainer.syncTransports.includes("local-network")) {
    throw new Error("Expected tablet device container to include local-network sync transport");
  }
  if (appState.deviceContainer.transportPlan?.publicNetworkLogin !== false) {
    throw new Error("Expected tablet device container transport plan to reject public-network login");
  }
  if (appState.syncPanel.discovery?.transportPlan?.recommendedTransport !== "local-network") {
    throw new Error("Expected tablet discovery to expose a local-network transport plan");
  }
  if (!appState.runtime.deviceId?.startsWith("device_tablet_")) {
    throw new Error(`Expected generated tablet device id, got ${appState.runtime.deviceId}`);
  }
  if (appState.runtime.records < 4) {
    throw new Error(`Expected seeded tablet records, got ${appState.runtime.records}`);
  }
  if (appState.security?.lockState !== "unlocked" || appState.security?.copyClearSeconds <= 0 || appState.security?.autoLockSeconds <= 0) {
    throw new Error("Expected tablet app-state to expose vault security status");
  }
  if (!appState.storage.persistedVault || !appState.storage.persistedRuntimeState) {
    throw new Error("Expected tablet shell to persist vault and runtime-state");
  }
  if (!appState.selectedRecord?.id || appState.selectedRecord.fields.length === 0) {
    throw new Error("Expected tablet shell to expose selected record detail");
  }
  if (!appState.reminderCenter?.items?.length || !appState.reminderCenter?.pending?.length) {
    throw new Error("Expected tablet shell to expose actionable reminder center items");
  }
  if (!appState.reminderCenter.items.some((item) => item.popupTitle?.includes("提醒") && item.popupBody?.includes("到期/触发时间"))) {
    throw new Error("Expected tablet reminder center to expose popup title and body content");
  }
  const persistedVaultAfterSeed = JSON.parse(readFileSync(vaultPath, "utf8"));
  const persistedRouterRecord = persistedVaultAfterSeed.records.find((record) => record.title === "Home Router Admin");
  const persistedRouterPassword = persistedRouterRecord?.fields.find((field) => field.key === "password");
  if (!persistedRouterPassword?.valueCipher?.startsWith("loginto-field-cipher-v1:") || persistedRouterPassword.valueCipher.includes("router-secret-2026")) {
    throw new Error("Expected tablet seeded password to be stored as encrypted field cipher");
  }

  const reminderAlertId = appState.reminderCenter.pending[0].alertId;
  const completed = await postJson(`${baseUrl}/api/reminders/action`, {
    action: "complete",
    alertId: reminderAlertId
  });
  if (completed.delivery.status !== "completed") {
    throw new Error("Expected tablet reminder action API to return completed status");
  }
  const snoozed = await postJson(`${baseUrl}/api/reminders/action`, {
    action: "snooze",
    alertId: reminderAlertId,
    snoozedUntil: "2026-06-25T10:00:00.000Z"
  });
  if (snoozed.delivery.status !== "snoozed") {
    throw new Error("Expected tablet reminder action API to return snoozed status");
  }
  const dismissed = await postJson(`${baseUrl}/api/reminders/action`, {
    action: "dismiss",
    alertId: reminderAlertId
  });
  if (dismissed.delivery.status !== "dismissed") {
    throw new Error("Expected tablet reminder action API to return dismissed status");
  }

  const created = await postJson(`${baseUrl}/api/records`, {
    type: "bank_card",
    title: "Smoke Tablet Card",
    account: "6222 **** 8899",
    reminderAt: "2027-03-01",
    notes: "Created from tablet smoke test.",
    attachment: {
      id: "attachment_tablet_smoke_card",
      encryptedBlobPath: "attachments/tablet-smoke-card.blob",
      mimeType: "image/jpeg",
      digest: "sha256-tablet-smoke-card",
      encryptedSize: 4096,
      source: "import"
    }
  });
  if (!created.ok || created.appState.runtime.records !== appState.runtime.records + 1) {
    throw new Error("Expected tablet record endpoint to create a local record");
  }
  const createdTabletRecord = created.appState.selectedRecord;
  if (createdTabletRecord?.attachmentCount !== 1 || createdTabletRecord.attachments?.[0]?.id !== "attachment_tablet_smoke_card") {
    throw new Error("Expected tablet record endpoint to create a record with an encrypted attachment reference");
  }
  const updated = await patchJson(`${baseUrl}/api/records`, {
    recordId: created.record.id,
    title: "Smoke Tablet Card Updated",
    notes: "Updated on tablet."
  });
  if (!updated.ok || updated.record.title !== "Smoke Tablet Card Updated") {
    throw new Error("Expected tablet record endpoint to update selected record metadata");
  }
  const removedAttachment = await deleteJson(`${baseUrl}/api/attachments`, {
    recordId: created.record.id,
    attachmentId: "attachment_tablet_smoke_card"
  });
  if (!removedAttachment.ok || removedAttachment.record.attachments !== 0) {
    throw new Error("Expected tablet attachment removal API to remove the record attachment reference");
  }
  const deleted = await deleteJson(`${baseUrl}/api/records`, {
    recordId: created.record.id
  });
  if (!deleted.ok || deleted.appState.runtime.records !== appState.runtime.records) {
    throw new Error("Expected tablet record endpoint to delete a local record");
  }

  const notes = await patchJson(`${baseUrl}/api/review/notes`, {
    recordId: appState.selectedRecord.id,
    notes: "Smoke test reviewed this record on the tablet shell."
  });
  if (!notes.ok || notes.updatedRecord.id !== appState.selectedRecord.id) {
    throw new Error("Expected tablet review notes endpoint to update the selected local record");
  }

  const review = await postJson(`${baseUrl}/api/review/confirm`, {});
  if (!review.ok || review.appState.runtime.records <= appState.runtime.records) {
    throw new Error("Expected tablet review action to add a local record");
  }
  if (review.reviewedRecord.attachments !== 1 || !review.reviewedRecord.attachmentNote?.includes(review.reviewedRecord.attachmentIds?.[0])) {
    throw new Error("Expected tablet review confirmation to save the source photo as an attachment note");
  }
  const persistedVaultAfterReview = JSON.parse(readFileSync(vaultPath, "utf8"));
  const persistedReviewedRecord = persistedVaultAfterReview.records.find((record) => record.id === review.reviewedRecord.id);
  const persistedReviewedNotes = persistedReviewedRecord?.fields.find((field) => field.key === "notes");
  if (!persistedReviewedNotes?.valueCipher?.startsWith("loginto-field-cipher-v1:") || persistedReviewedNotes.valueCipher.includes(review.reviewedRecord.attachmentIds?.[0])) {
    throw new Error("Expected tablet review attachment note to be stored as encrypted field cipher");
  }
  const reviewedTile = review.appState.viewState.recent.find((record) => record.id === review.reviewedRecord.id);
  if (reviewedTile?.attachmentCount !== 1 || !reviewedTile.notesPreview?.includes(review.reviewedRecord.attachmentIds[0])) {
    throw new Error("Expected tablet reviewed record tile to expose the attachment note");
  }

  const publicEndpointQr = createDesktopPairingQrPayload("https://public.example.com:4173");
  const publicEndpointTrust = await postJsonAllowFailure(`${baseUrl}/api/pairing/trust`, {
    payloadText: publicEndpointQr.payloadText,
    confirmedCode: publicEndpointQr.verificationCode
  });
  if (publicEndpointTrust.ok || !publicEndpointTrust.text.includes("public network sync is not allowed")) {
    throw new Error(`Expected tablet pairing trust to reject public-network endpoints: ${publicEndpointTrust.text}`);
  }
  const directIdentityTrust = await postJsonAllowFailure(`${baseUrl}/api/pairing/trust`, {
    deviceId: "device_direct_desktop",
    deviceName: "Direct Desktop",
    publicKeyBase64: "direct-desktop-public-key"
  });
  if (directIdentityTrust.ok || !directIdentityTrust.text.includes("pairing QR payload")) {
    throw new Error(`Expected tablet pairing trust to reject direct device identity trust: ${directIdentityTrust.text}`);
  }
  const desktopPairingQr = createDesktopPairingQrPayload("http://127.0.0.1:43110");
  const missingCodeTrust = await postJsonAllowFailure(`${baseUrl}/api/pairing/trust`, {
    payloadText: desktopPairingQr.payloadText
  });
  if (missingCodeTrust.ok || !missingCodeTrust.text.includes("six-digit verification code")) {
    throw new Error(`Expected tablet QR pairing trust to require a verification code: ${missingCodeTrust.text}`);
  }
  const wrongCodeTrust = await postJsonAllowFailure(`${baseUrl}/api/pairing/trust`, {
    payloadText: desktopPairingQr.payloadText,
    confirmedCode: "000000"
  });
  if (wrongCodeTrust.ok || !wrongCodeTrust.text.includes("verification code does not match")) {
    throw new Error(`Expected tablet QR pairing trust to reject a wrong verification code: ${wrongCodeTrust.text}`);
  }
  const trust = await postJson(`${baseUrl}/api/pairing/trust`, {
    payloadText: desktopPairingQr.payloadText,
    confirmedCode: desktopPairingQr.verificationCode
  });
  if (trust.trustedDevices !== 1 || trust.trustedDevice.kind !== "desktop") {
    throw new Error("Expected tablet QR pairing trust action to persist a desktop device");
  }
  if (trust.pairing?.verificationCode !== desktopPairingQr.verificationCode) {
    throw new Error("Expected tablet QR pairing trust response to echo the verified six-digit code");
  }

  resetTabletShellRuntimeForTests();
  const reloaded = await fetchJson(`${baseUrl}/api/app-state`);
  if (reloaded.runtime.records !== review.appState.runtime.records) {
    throw new Error("Expected tablet vault snapshot to survive runtime reload");
  }
  if (reloaded.runtime.trustedDevices !== 1) {
    throw new Error("Expected tablet trusted device state to survive runtime reload");
  }
  if (!reloaded.notificationState.deliveries.some((delivery) => delivery.alertId === reminderAlertId && delivery.status === "dismissed")) {
    throw new Error("Expected tablet dismissed reminder state to survive runtime reload");
  }

  console.log("Tablet app shell smoke test passed.");
  console.log(
    JSON.stringify(
      {
        baseUrl,
        htmlBytes: html.length,
        runtimeRecords: appState.runtime.records,
        completedReminderStatus: completed.delivery.status,
        snoozedReminderStatus: snoozed.delivery.status,
        dismissedReminderStatus: dismissed.delivery.status,
        tabletCrudRecord: updated.record.title,
        recordsAfterDelete: deleted.appState.runtime.records,
        recordsAfterReview: review.appState.runtime.records,
        recordsAfterReload: reloaded.runtime.records,
        notesRecord: notes.updatedRecord.title,
        trustedDevicesAfterReload: reloaded.runtime.trustedDevices,
        deviceContainer: reloaded.deviceContainer.kind,
        pairingVerificationCode: trust.pairing.verificationCode,
        persistedVault: reloaded.storage.persistedVault,
        persistedRuntimeState: reloaded.storage.persistedRuntimeState,
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
      id: "device_desktop_for_tablet_shell_smoke",
      name: "LoginTo Desktop Shell",
      kind: "desktop",
      publicKeyBase64: "tablet-app-shell-smoke-desktop-public-key",
      now: () => "2026-06-13T18:20:00.000Z"
    }),
    sessionId: "pairing_tablet_shell_smoke",
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
