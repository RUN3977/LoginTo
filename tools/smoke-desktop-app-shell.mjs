import { rm } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const root = process.cwd();
const vaultPath = join(root, ".tmp", "desktop-app-shell-smoke.vault-snapshot.json");
const runtimeStatePath = join(root, ".tmp", "desktop-app-shell-smoke.runtime-state.json");
const backupPackagePath = join(root, ".tmp", "desktop-app-shell-smoke.backup-package.json");
const backupVerifyVaultPath = join(root, ".tmp", "desktop-app-shell-smoke.backup-verify.vault-snapshot.json");
const backupVerifyRuntimeStatePath = join(root, ".tmp", "desktop-app-shell-smoke.backup-verify.runtime-state.json");

await rm(vaultPath, { force: true });
await rm(`${vaultPath}.tmp`, { force: true });
await rm(`${vaultPath}.sync-deletions.json`, { force: true });
await rm(`${vaultPath}.sync-deletions.json.tmp`, { force: true });
await rm(runtimeStatePath, { force: true });
await rm(`${runtimeStatePath}.tmp`, { force: true });
await rm(backupPackagePath, { force: true });
await rm(backupVerifyVaultPath, { force: true });
await rm(backupVerifyRuntimeStatePath, { force: true });
process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH = vaultPath;
process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH = runtimeStatePath;
process.env.LOGINTO_DESKTOP_BACKUP_PACKAGE_PATH = backupPackagePath;
process.env.LOGINTO_DESKTOP_BACKUP_VERIFY_VAULT_PATH = backupVerifyVaultPath;
process.env.LOGINTO_DESKTOP_BACKUP_VERIFY_RUNTIME_STATE_PATH = backupVerifyRuntimeStatePath;

const { createDesktopShellServer } = await import("../apps/desktop/scripts/dev-server.mjs");
const sync = await import("../packages/sync-core/src/index.ts");

const server = createDesktopShellServer();

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const [homeResponse, statusResponse, appStateResponse] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/api/status`),
    fetch(`${baseUrl}/api/app-state`)
  ]);
  const secondAppStateResponse = await fetch(`${baseUrl}/api/app-state`);

  if (!homeResponse.ok) {
    throw new Error(`Expected desktop shell home to return 200, got ${homeResponse.status}`);
  }
  if (!statusResponse.ok) {
    throw new Error(`Expected desktop shell status to return 200, got ${statusResponse.status}`);
  }
  if (!appStateResponse.ok) {
    throw new Error(`Expected desktop shell app-state to return 200, got ${appStateResponse.status}`);
  }
  if (!secondAppStateResponse.ok) {
    throw new Error(`Expected second desktop shell app-state to return 200, got ${secondAppStateResponse.status}`);
  }

  const html = await homeResponse.text();
  const status = await statusResponse.json();
  const appState = await appStateResponse.json();
  const secondAppState = await secondAppStateResponse.json();
  if (!html.includes("data-conflict-list") || !html.includes("data-conflict-confirm") || !html.includes("data-conflict-resolution")) {
    throw new Error("Expected desktop shell HTML to include formal conflict decision controls");
  }
  if (!html.includes("data-sync-review-records") || !html.includes("data-sync-review-confirm") || !html.includes("data-sync-review-trust") || !html.includes("data-sync-review-expires") || !html.includes("同步摘要已过期") || !html.includes("data-sync-review-peer-url") || !html.includes("data-sync-review-fingerprint") || !html.includes("data-sync-review-public-network") || !html.includes("formatSyncReviewTrust") || !html.includes("openSyncReviewDialog")) {
    throw new Error("Expected desktop shell HTML to include formal sync review controls");
  }
  if (!html.includes("data-candidate-action") || !html.includes("data-candidate-reason")) {
    throw new Error("Expected desktop shell HTML to explain and resolve near-field candidate actions");
  }
  if (!html.includes("data-desktop-pairing-payload") || !html.includes("data-desktop-pairing-copy") || !html.includes("copyPairingPayloadBtn")) {
    throw new Error("Expected desktop shell HTML to expose copyable QR pairing payload text");
  }
  if (!html.includes("recordForm")) {
    throw new Error("Expected desktop shell HTML to include the add-record form");
  }
  if (!html.includes("data-desktop-reminder-tabs") || !html.includes("data-desktop-reminder-list") || !html.includes("data-reminder-action=\"dismiss\"")) {
    throw new Error("Expected desktop shell HTML to include a formal reminder center");
  }
  if (!html.includes("data-backup-panel") || !html.includes("data-action=\"backup-export\"") || !html.includes("data-action=\"backup-verify\"")) {
    throw new Error("Expected desktop shell HTML to include a local backup panel");
  }
  if (!html.includes("data-attachment-action=\"remove\"") || !html.includes("/api/attachments")) {
    throw new Error("Expected desktop shell HTML to expose encrypted attachment removal");
  }
  if (!html.includes("data-security-panel") || !html.includes("data-security-lock-state") || !html.includes("data-security-second-unlock") || !html.includes("data-security-copy-clear")) {
    throw new Error("Expected desktop shell HTML to include local vault security status");
  }
  if (!html.includes("data-local-data-panel") || !html.includes("data-local-data-vault") || !html.includes("renderLocalDataPanel")) {
    throw new Error("Expected desktop shell HTML to include local data storage status");
  }
  if (!html.includes("data-desktop-sync-audit-log") || !html.includes("data-sync-recovery-action")) {
    throw new Error("Expected desktop shell HTML to include sync audit recovery actions");
  }
  if (!html.includes("data-backup-confirm") || !html.includes("backupConfirm.checked")) {
    throw new Error("Expected desktop shell HTML to require backup export confirmation");
  }

  if (!html.includes("LoginTo") || !html.includes("会员到期提醒") || !html.includes("提醒中心")) {
    throw new Error("Expected desktop shell HTML to include product UI");
  }
  if (html.includes("宸插彇")) {
    throw new Error("Expected desktop shell HTML to avoid garbled Chinese sync cancel copy");
  }
  if (status.product !== "LoginTo desktop shell") {
    throw new Error(`Unexpected status product: ${status.product}`);
  }
  if (appState.records.length < 4 || appState.reminderModal.status !== "pending") {
    throw new Error("Expected desktop shell app-state to include records and pending reminder");
  }
  if (!appState.reminderCenter?.items?.length || appState.reminderCenter.due.length < 1 || !appState.reminderCenter.filters.some((filter) => filter.id === "upcoming")) {
    throw new Error("Expected desktop shell app-state to expose a reminder center with due and upcoming filters");
  }
  const appStateText = JSON.stringify(appState);
  for (const secret of ["github-secret-2026", "ABCD-EFGH-IJKL", "6225 8800 0000 0826", "E12345678", "secretValue"]) {
    if (appStateText.includes(secret)) {
      throw new Error(`Expected desktop app-state not to leak sensitive field material: ${secret}`);
    }
  }
  if (!appState.reminderModal.title.includes("提醒") || !appState.reminderModal.body.includes("到期/触发时间")) {
    throw new Error("Expected desktop reminder modal to expose concrete popup title and body");
  }
  if (!appState.reminderCenter.items.some((item) => item.popupTitle === "银行卡提醒" && item.popupBody.includes("到期/触发时间"))) {
    throw new Error("Expected desktop reminder center to expose bank card popup content");
  }
  if (appState.backup?.format !== "loginto-vault-package-v1" || !appState.backup?.targetPath?.endsWith("desktop-app-shell-smoke.backup-package.json")) {
    throw new Error("Expected desktop shell app-state to expose local backup package status");
  }
  if (appState.security?.lockState !== "unlocked" || appState.security?.copyClearSeconds <= 0 || appState.security?.autoLockSeconds <= 0) {
    throw new Error("Expected desktop shell app-state to expose vault security status");
  }
  if (!appState.vault?.vaultPath?.includes(".tmp") || !appState.vault?.runtimeStatePath?.includes(".tmp") || !appState.vault?.storageKind) {
    throw new Error("Expected desktop shell app-state to expose local storage paths");
  }
  if (appState.sync.protocol !== "loginto-pairing-v1" || appState.sync.qrFormat !== "loginto-pairing-qr-v1" || appState.sync.qrStandard !== "qr-code" || appState.sync.qrCells.length !== appState.sync.qrSize * appState.sync.qrSize || !appState.sync.qrSvg?.includes("<svg") || !appState.sync.pairingPayload?.sessionId) {
    throw new Error("Expected desktop shell app-state to include a pairing payload preview");
  }
  const decodedAppStatePairingPayload = sync.decodePairingPayloadText(appState.sync.qrPayloadText);
  if (decodedAppStatePairingPayload.sessionId !== appState.sync.pairingPayload.sessionId) {
    throw new Error("Expected app-state pairing QR payload text to decode back to the local pairing payload");
  }
  if (appState.sync.legacyMatrixFormat !== "loginto-pairing-matrix-v1" || appState.sync.legacyMatrixCells.length !== appState.sync.legacyMatrixSize * appState.sync.legacyMatrixSize) {
    throw new Error("Expected app-state to retain the legacy pairing matrix during QR migration");
  }
  if (secondAppState.records.length !== appState.records.length) {
    throw new Error("Expected desktop shell app-state reload to avoid duplicate seed records");
  }
  if (!existsSync(vaultPath) || !existsSync(runtimeStatePath)) {
    throw new Error("Expected desktop shell app-state to persist vault and runtime-state files");
  }

  const backupResponse = await fetch(`${baseUrl}/api/backup/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!backupResponse.ok) {
    throw new Error(`Expected backup export endpoint to return 200, got ${backupResponse.status}`);
  }
  const backup = await backupResponse.json();
  if (!backup.ok || backup.summary.format !== "loginto-vault-package-v1" || backup.summary.records !== appState.records.length || !backup.packageJson.includes("backup-package")) {
    throw new Error("Expected backup export endpoint to return an encrypted vault package summary");
  }
  if (!existsSync(backupPackagePath)) {
    throw new Error("Expected backup export endpoint to persist the encrypted backup package file");
  }
  const verifyResponse = await fetch(`${baseUrl}/api/backup/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageJson: backup.packageJson })
  });
  if (!verifyResponse.ok) {
    throw new Error(`Expected backup verify endpoint to return 200, got ${verifyResponse.status}`);
  }
  const verifiedBackup = await verifyResponse.json();
  if (
    !verifiedBackup.ok ||
    verifiedBackup.summary.records !== appState.records.length ||
    !Number.isFinite(verifiedBackup.summary.attachments) ||
    !existsSync(backupVerifyVaultPath)
  ) {
    throw new Error("Expected backup verify endpoint to prove the encrypted package can restore records");
  }
  const githubRecord = appState.records.find((record) => record.id === "github");
  if (!githubRecord) {
    throw new Error("Expected desktop shell app-state to include GitHub demo record");
  }
  const deniedCriticalResponse = await fetch(`${baseUrl}/api/fields/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordId: githubRecord.id,
      fieldLabel: "2FA 备用码",
      secondUnlock: false
    })
  });
  if (!deniedCriticalResponse.ok) {
    throw new Error(`Expected denied critical reveal to return 200, got ${deniedCriticalResponse.status}`);
  }
  const deniedCritical = await deniedCriticalResponse.json();
  if (deniedCritical.ok || deniedCritical.denied[0]?.reason !== "second-unlock-required") {
    throw new Error("Expected critical field reveal to require second unlock");
  }
  const revealCriticalResponse = await fetch(`${baseUrl}/api/fields/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordId: githubRecord.id,
      fieldLabel: "2FA 备用码",
      secondUnlock: true
    })
  });
  if (!revealCriticalResponse.ok) {
    throw new Error(`Expected critical reveal action to return 200, got ${revealCriticalResponse.status}`);
  }
  const revealCritical = await revealCriticalResponse.json();
  if (!revealCritical.ok || revealCritical.fields[0]?.value !== "ABCD-EFGH-IJKL") {
    throw new Error("Expected second unlock to reveal the critical field value");
  }
  const persistedVaultAfterReveal = JSON.parse(readFileSync(vaultPath, "utf8"));
  const persistedGithubRecord = persistedVaultAfterReveal.records.find((record) => record.id === githubRecord.recordId);
  const persistedCriticalField = persistedGithubRecord?.fields.find((field) => field.key === "otp_backup");
  if (!persistedCriticalField?.valueCipher?.startsWith("loginto-field-cipher-v1:") || persistedCriticalField.valueCipher.includes("ABCD-EFGH-IJKL")) {
    throw new Error("Expected critical reveal to decrypt from the persisted encrypted field cipher");
  }
  if (!revealCritical.security?.secondUnlockedUntil) {
    throw new Error("Expected second unlock response to include updated vault security status");
  }
  const copyPasswordResponse = await fetch(`${baseUrl}/api/fields/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordId: githubRecord.id,
      fieldLabel: "密码",
      action: "copy"
    })
  });
  if (!copyPasswordResponse.ok) {
    throw new Error(`Expected copy field action to return 200, got ${copyPasswordResponse.status}`);
  }
  const copyPassword = await copyPasswordResponse.json();
  if (!copyPassword.ok || !copyPassword.fields[0]?.copyClearAt) {
    throw new Error("Expected copy field action to include clipboard clear plan");
  }
  const pairingResponse = await fetch(`${baseUrl}/api/pairing/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!pairingResponse.ok) {
    throw new Error(`Expected pairing start action to return 200, got ${pairingResponse.status}`);
  }
  const pairingPreview = await pairingResponse.json();
  if (pairingPreview.protocol !== "loginto-pairing-v1" || pairingPreview.qrFormat !== "loginto-pairing-qr-v1" || pairingPreview.qrStandard !== "qr-code" || pairingPreview.qrCells.length !== pairingPreview.qrSize * pairingPreview.qrSize || !pairingPreview.qrSvg?.includes("<svg") || pairingPreview.sixDigitCode.length !== 6) {
    throw new Error("Expected pairing start action to return protocol, standard QR cells, and six-digit code");
  }
  const decodedPairingPayload = sync.decodePairingPayloadText(pairingPreview.qrPayloadText);
  if (decodedPairingPayload.sessionId !== pairingPreview.pairingPayload.sessionId) {
    throw new Error("Expected pairing QR payload text to decode back to the local pairing payload");
  }
  if (decodedPairingPayload.localEndpoint !== baseUrl || pairingPreview.localEndpoint !== baseUrl) {
    throw new Error(`Expected pairing QR to advertise the current temporary desktop endpoint ${baseUrl}`);
  }
  if (!decodedPairingPayload.expiresAt || Date.parse(decodedPairingPayload.expiresAt) <= Date.parse(decodedPairingPayload.createdAt)) {
    throw new Error("Expected pairing QR to include a future expiry time");
  }
  const emptyPairingConfirmResponse = await fetch(`${baseUrl}/api/pairing/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!emptyPairingConfirmResponse.ok) {
    throw new Error(`Expected empty pairing confirm action to return 200, got ${emptyPairingConfirmResponse.status}`);
  }
  const emptyPairingConfirm = await emptyPairingConfirmResponse.json();
  if (emptyPairingConfirm.ok || emptyPairingConfirm.reason !== "remote-pairing-payload-required") {
    throw new Error("Expected desktop pairing confirm to require a remote face-to-face payload");
  }
  const remotePairingPayload = sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: "device_phone_shell",
      name: "LoginTo Phone",
      kind: "phone",
      publicKeyBase64: "phone-shell-public-key",
      now: () => "2026-12-20T09:00:00.000Z"
    }),
    sessionId: "pairing_phone_shell_smoke",
    localEndpoint: "http://127.0.0.1:43111",
    ttlSeconds: 300,
    now: () => "2026-12-20T09:00:00.000Z"
  });
  const publicRemotePairingPayload = {
    ...remotePairingPayload,
    localEndpoint: "https://public.example.com:43111"
  };
  const publicEndpointVerification = sync.createPairingVerification(pairingPreview.pairingPayload, publicRemotePairingPayload);
  const publicEndpointPairingResponse = await fetch(`${baseUrl}/api/pairing/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      localSessionId: pairingPreview.pairingPayload.sessionId,
      remotePairingPayload: publicRemotePairingPayload,
      confirmedCode: publicEndpointVerification.sixDigitCode
    })
  });
  if (publicEndpointPairingResponse.ok) {
    throw new Error("Expected desktop pairing confirm to reject public-network peer endpoints");
  }
  const publicEndpointPairingText = await publicEndpointPairingResponse.text();
  if (!publicEndpointPairingText.includes("public network sync is not allowed")) {
    throw new Error(`Expected desktop pairing confirm to reject public-network endpoint: ${publicEndpointPairingText}`);
  }
  const missingCodePairingConfirmResponse = await fetch(`${baseUrl}/api/pairing/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      localSessionId: pairingPreview.pairingPayload.sessionId,
      remotePairingPayload
    })
  });
  const missingCodePairingConfirm = await missingCodePairingConfirmResponse.json();
  if (missingCodePairingConfirm.ok || missingCodePairingConfirm.reason !== "pairing-code-required") {
    throw new Error("Expected desktop pairing confirm to require the six-digit verification code");
  }
  const verification = sync.createPairingVerification(pairingPreview.pairingPayload, remotePairingPayload);
  const pairingConfirmResponse = await fetch(`${baseUrl}/api/pairing/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      localSessionId: pairingPreview.pairingPayload.sessionId,
      remotePairingPayload,
      confirmedCode: verification.sixDigitCode
    })
  });
  if (!pairingConfirmResponse.ok) {
    throw new Error(`Expected pairing confirm action to return 200, got ${pairingConfirmResponse.status}`);
  }
  const pairingConfirm = await pairingConfirmResponse.json();
  if (!pairingConfirm.ok || pairingConfirm.status !== "trusted" || pairingConfirm.trustedDevice?.id !== "device_phone_shell") {
    throw new Error("Expected pairing confirm action to trust the face-to-face verified phone device");
  }
  const persistedStateAfterPairing = JSON.parse(readFileSync(runtimeStatePath, "utf8"));
  if (!persistedStateAfterPairing.trustedDevices?.some((device) => device.id === "device_phone_shell")) {
    throw new Error("Expected pairing confirm action to persist trusted phone device");
  }
  const appStateAfterPairingResponse = await fetch(`${baseUrl}/api/app-state`);
  const appStateAfterPairing = await appStateAfterPairingResponse.json();
  if (appStateAfterPairing.sync.trustedDevices !== 1) {
    throw new Error("Expected reloaded desktop shell app-state to restore persisted trusted devices");
  }
  const createRecordResponse = await fetch(`${baseUrl}/api/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "bank_card",
      title: "UI Form Bank Card",
      values: {
        cardholder: "UI Form Bank Card",
        card_number: "6225 9900 0000 6618",
        bank_name: "UI Bank",
        statement_day: "18",
        notes: "Created from the desktop form payload."
      },
      reminderDrafts: [
        {
          dueAt: "2026-07-18T09:00:00.000Z",
          message: "UI Form Bank Card statement reminder",
          daysBefore: 0
        }
      ],
      attachment: {
        id: "attachment_desktop_smoke_card",
        encryptedBlobPath: "attachments/desktop-smoke-card.blob",
        mimeType: "image/jpeg",
        digest: "sha256-desktop-smoke-card",
        encryptedSize: 3072,
        source: "import"
      }
    })
  });
  if (!createRecordResponse.ok) {
    throw new Error(`Expected create record action to return 200, got ${createRecordResponse.status}`);
  }
  const createdRecordState = await createRecordResponse.json();
  if (createdRecordState.records.length !== appState.records.length + 1) {
    throw new Error("Expected create record action to append one UI record");
  }
  const persistedVaultAfterCreate = JSON.parse(readFileSync(vaultPath, "utf8"));
  if (persistedVaultAfterCreate.records.length !== createdRecordState.records.length) {
    throw new Error("Expected create record action to persist the new vault record");
  }
  const persistedUiFormRecord = persistedVaultAfterCreate.records.find((record) => record.title === "UI Form Bank Card");
  if (!persistedUiFormRecord || persistedUiFormRecord.type !== "bank_card" || persistedUiFormRecord.reminders.length !== 1) {
    throw new Error("Expected desktop form payload to persist a typed bank card with a reminder");
  }
  if (persistedUiFormRecord.attachments.length !== 1 || persistedUiFormRecord.attachments[0].id !== "attachment_desktop_smoke_card") {
    throw new Error("Expected desktop form payload to persist an encrypted attachment reference");
  }
  const removedAttachmentResponse = await fetch(`${baseUrl}/api/attachments`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordId: persistedUiFormRecord.id,
      attachmentId: persistedUiFormRecord.attachments[0].id
    })
  });
  if (!removedAttachmentResponse.ok) {
    throw new Error(`Expected desktop attachment removal to return 200, got ${removedAttachmentResponse.status}`);
  }
  const removedAttachment = await removedAttachmentResponse.json();
  const desktopAttachmentRecordAfterRemove = removedAttachment.appState.records.find((record) => record.recordId === persistedUiFormRecord.id || record.id === persistedUiFormRecord.id);
  if (!removedAttachment.ok || removedAttachment.record.attachments !== 0 || desktopAttachmentRecordAfterRemove?.attachmentCount !== 0) {
    throw new Error("Expected desktop attachment removal API to remove the record attachment reference");
  }
  const updateRecordResponse = await fetch(`${baseUrl}/api/records`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordId: persistedUiFormRecord.id,
      title: "UI Form Bank Card Updated",
      notes: "Edited from the desktop detail form."
    })
  });
  if (!updateRecordResponse.ok) {
    throw new Error(`Expected update record action to return 200, got ${updateRecordResponse.status}`);
  }
  const updatedVaultAfterEdit = JSON.parse(readFileSync(vaultPath, "utf8"));
  const updatedUiFormRecord = updatedVaultAfterEdit.records.find((record) => record.id === persistedUiFormRecord.id);
  if (!updatedUiFormRecord || updatedUiFormRecord.title !== "UI Form Bank Card Updated") {
    throw new Error("Expected desktop edit action to persist the updated record title");
  }
  const deleteRecordResponse = await fetch(`${baseUrl}/api/records`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordId: persistedUiFormRecord.id
    })
  });
  if (!deleteRecordResponse.ok) {
    throw new Error(`Expected delete record action to return 200, got ${deleteRecordResponse.status}`);
  }
  const deletedRecordState = await deleteRecordResponse.json();
  const persistedVaultAfterDelete = JSON.parse(readFileSync(vaultPath, "utf8"));
  if (persistedVaultAfterDelete.records.some((record) => record.id === persistedUiFormRecord.id)) {
    throw new Error("Expected desktop delete action to remove the record from the persisted vault");
  }
  if (deletedRecordState.records.length !== appState.records.length) {
    throw new Error("Expected desktop delete action to restore the UI record count after removing the created record");
  }
  if (!appState.reminderModal.alertId) {
    throw new Error("Expected desktop shell app-state to expose reminder alert id");
  }

  const completeResponse = await fetch(`${baseUrl}/api/reminders/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "complete",
      alertId: appState.reminderModal.alertId
    })
  });
  if (!completeResponse.ok) {
    throw new Error(`Expected complete reminder action to return 200, got ${completeResponse.status}`);
  }
  const completedState = JSON.parse(readFileSync(runtimeStatePath, "utf8"));
  if (!completedState.reminderNotifications.deliveries.some((delivery) => delivery.status === "completed")) {
    throw new Error("Expected complete reminder action to persist completed status");
  }

  await rm(vaultPath, { force: true });
  await rm(runtimeStatePath, { force: true });
  const freshStateResponse = await fetch(`${baseUrl}/api/app-state`);
  const freshState = await freshStateResponse.json();
  const snoozeResponse = await fetch(`${baseUrl}/api/reminders/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "snooze",
      alertId: freshState.reminderModal.alertId,
      snoozedUntil: "2026-12-20T10:00:00.000Z"
    })
  });
  if (!snoozeResponse.ok) {
    throw new Error(`Expected snooze reminder action to return 200, got ${snoozeResponse.status}`);
  }
  const snoozedState = JSON.parse(readFileSync(runtimeStatePath, "utf8"));
  if (!snoozedState.reminderNotifications.deliveries.some((delivery) => delivery.status === "snoozed")) {
    throw new Error("Expected snooze reminder action to persist snoozed status");
  }
  const dismissResponse = await fetch(`${baseUrl}/api/reminders/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "dismiss",
      alertId: freshState.reminderModal.alertId
    })
  });
  if (!dismissResponse.ok) {
    throw new Error(`Expected dismiss reminder action to return 200, got ${dismissResponse.status}`);
  }
  const dismissedState = JSON.parse(readFileSync(runtimeStatePath, "utf8"));
  if (!dismissedState.reminderNotifications.deliveries.some((delivery) => delivery.status === "dismissed")) {
    throw new Error("Expected dismiss reminder action to persist dismissed status");
  }

  console.log("Desktop app shell smoke test passed.");
  console.log(
    JSON.stringify(
      {
        baseUrl,
        stage: status.stage,
        capabilities: status.capabilities.length,
        records: appState.records.length,
        recordsAfterCreate: createdRecordState.records.length,
        dueReminders: appState.vault.dueReminders,
        persistedVault: existsSync(vaultPath),
        persistedRuntimeState: existsSync(runtimeStatePath),
        backupPackageFormat: backup.summary.format,
        backupVerifiedRecords: verifiedBackup.summary.records,
        backupVerifiedAttachments: verifiedBackup.summary.attachments,
        criticalRevealDenied: deniedCritical.denied[0].reason,
        copyClearAt: copyPassword.fields[0].copyClearAt,
        pairingCode: pairingPreview.sixDigitCode,
        pairingMatrixSize: pairingPreview.qrSize,
        trustedPairingCode: pairingConfirm.verification.sixDigitCode,
        trustedDevices: appStateAfterPairing.sync.trustedDevices,
        completedActions: completedState.reminderNotifications.deliveries.filter((delivery) => delivery.status === "completed").length,
        snoozedActions: snoozedState.reminderNotifications.deliveries.filter((delivery) => delivery.status === "snoozed").length,
        dismissedActions: dismissedState.reminderNotifications.deliveries.filter((delivery) => delivery.status === "dismissed").length,
        htmlBytes: html.length
      },
      null,
      2
    )
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
