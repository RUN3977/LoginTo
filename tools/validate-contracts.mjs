import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "README.md",
  "LoginTo.cmd",
  "LoginTo-SQLite.cmd",
  "LoginTo-App-Windows.cmd",
  "LoginTo-App-Desktop.cmd",
  "LoginTo-App-Phone.cmd",
  "LoginTo-App-Tablet.cmd",
  "LoginTo-Desktop.cmd",
  "LoginTo-Start.cmd",
  "LoginTo-Start-SQLite.cmd",
  "LoginTo-Check.cmd",
  "LoginTo-Stop.cmd",
  "LoginTo-Data-Folder.cmd",
  "LoginTo-Report.cmd",
  "LoginTo-Reset-Preview.cmd",
  "LoginTo-Reset-Demo.cmd",
  "LoginTo-Acceptance.cmd",
  "LoginTo-Package.cmd",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "docs/architecture.md",
  "docs/m0-checklist.md",
  "docs/m1-progress.md",
  "docs/threat-model.md",
  "docs/LoginTo_MVP与实施规划.docx",
  "tools/demo-current-product.mjs",
  "tools/run-all-smoke.mjs",
  "tools/accept-usable-preview.mjs",
  "tools/check-terminal-previews.mjs",
  "tools/create-readiness-report.mjs",
  "tools/package-usable-preview.mjs",
  "tools/reset-preview-state.mjs",
  "tools/start-desktop-native-shell.mjs",
  "tools/start-terminal-app-windows.mjs",
  "tools/start-terminal-previews.mjs",
  "tools/start-terminal-previews-detached.mjs",
  "tools/run-terminal-previews.cmd",
  "tools/use-toolchain.ps1",
  "tools/with-toolchain.cmd",
  "tools/smoke-async-app-workflows.mjs",
  "tools/smoke-async-field-encryption.mjs",
  "tools/smoke-attachment-encryption.mjs",
  "tools/smoke-atomic-file-storage.mjs",
  "tools/smoke-native-crypto-adapter.mjs",
  "tools/smoke-webcrypto-adapter.mjs",
  "tools/smoke-vault-core.mjs",
  "tools/smoke-app-near-field-endpoints.mjs",
  "tools/smoke-app-pairing-workflow.mjs",
  "tools/smoke-app-runtimes.mjs",
  "tools/smoke-desktop-app-shell.mjs",
  "tools/smoke-desktop-native-shell.mjs",
  "tools/smoke-terminal-app-windows.mjs",
  "tools/smoke-desktop-notification-bridge.mjs",
  "tools/smoke-desktop-backup-restore.mjs",
  "tools/smoke-desktop-sqlite-backup-restore.mjs",
  "tools/smoke-desktop-sqlite-runtime.mjs",
  "tools/smoke-desktop-sqlite-shell.mjs",
  "tools/smoke-desktop-sqlite-sync-state.mjs",
  "tools/smoke-desktop-local-network-transport.mjs",
  "tools/smoke-desktop-network-candidates.mjs",
  "tools/smoke-desktop-reminder-notification-state.mjs",
  "tools/smoke-desktop-storage.mjs",
  "tools/smoke-desktop-session.mjs",
  "tools/smoke-desktop-view-state.mjs",
  "tools/smoke-mobile-app-shell.mjs",
  "tools/smoke-mobile-encrypted-capture.mjs",
  "tools/smoke-mobile-expo-storage.mjs",
  "tools/smoke-mobile-local-network-transport.mjs",
  "tools/smoke-mobile-camera-scanner.mjs",
  "tools/smoke-mobile-camera-capture-session.mjs",
  "tools/smoke-mobile-pairing-client.mjs",
  "tools/smoke-mobile-runtime-state.mjs",
  "tools/smoke-mobile-ocr-workflow.mjs",
  "tools/smoke-mobile-view-state.mjs",
  "tools/smoke-tablet-app-shell.mjs",
  "tools/smoke-terminal-shells.mjs",
  "tools/smoke-terminal-discovery-shells.mjs",
  "tools/smoke-discovery-candidate-actions.mjs",
  "tools/smoke-terminal-previews-detached.mjs",
  "tools/smoke-package-usable-preview.mjs",
  "tools/smoke-reset-preview-state.mjs",
  "tools/smoke-ocr-draft.mjs",
  "tools/smoke-pairing-matrix.mjs",
  "tools/smoke-pairing-workflow.mjs",
  "tools/smoke-reminder-notifications.mjs",
  "tools/smoke-terminal-notification-bridge.mjs",
  "tools/smoke-reminders.mjs",
  "tools/smoke-runtime-reminder-notifications.mjs",
  "tools/smoke-runtime-terminal-notifications.mjs",
  "tools/smoke-runtime-native-crypto.mjs",
  "tools/smoke-runtime-security.mjs",
  "tools/smoke-near-field-endpoint.mjs",
  "tools/smoke-near-field-handler.mjs",
  "tools/smoke-near-field-discovery-candidates.mjs",
  "tools/smoke-near-field-connection-state.mjs",
  "tools/smoke-near-field-endpoint-probe.mjs",
  "tools/smoke-near-field-transport.mjs",
  "tools/smoke-sync-demo-failure-states.mjs",
  "tools/smoke-bluetooth-sync-envelope.mjs",
  "tools/smoke-sqlite-adapter.mjs",
  "tools/smoke-sync-apply.mjs",
  "tools/smoke-sync-core.mjs",
  "tools/smoke-sync-conflicts.mjs",
  "tools/smoke-sync-delete-propagation.mjs",
  "tools/smoke-sync-exchange.mjs",
  "tools/smoke-sync-failure-receipts.mjs",
  "tools/smoke-sync-receipt-summary.mjs",
  "tools/smoke-sync-review-contract.mjs",
  "tools/smoke-trusted-device-management.mjs",
  "tools/smoke-sync-manual-merge-vault.mjs",
  "tools/smoke-sync-paired-device-key.mjs",
  "tools/smoke-sync-tablet-to-desktop.mjs",
  "tools/smoke-sync-trust-gate.mjs",
  "tools/smoke-device-identity-unique-keys.mjs",
  "tools/smoke-sync-state.mjs",
  "tools/smoke-sync-session.mjs",
  "tools/smoke-vault-security.mjs",
  "apps/desktop/README.md",
  "apps/desktop/package.json",
  "apps/desktop/prototype/index.html",
  "apps/desktop/scripts/app-state.mjs",
  "apps/desktop/scripts/check-app-shell.mjs",
  "apps/desktop/scripts/dev-server.mjs",
  "apps/desktop/scripts/notification-bridge.mjs",
  "apps/desktop/src/file-vault-storage.ts",
  "apps/desktop/src/local-network-transport.ts",
  "apps/desktop/src/near-field-endpoint.ts",
  "apps/desktop/src/pairing-workflow.ts",
  "apps/desktop/src/runtime.ts",
  "apps/desktop/src/runtime-state-storage.ts",
  "apps/desktop/src/sqlite-vault-storage.ts",
  "apps/desktop/src/sync-session.ts",
  "apps/desktop/src/vault-session.ts",
  "apps/desktop/src/view-state.ts",
  "apps/mobile/README.md",
  "apps/mobile/package.json",
  "apps/mobile/prototype/index.html",
  "apps/mobile/scripts/app-state.mjs",
  "apps/mobile/scripts/capture-session.mjs",
  "apps/mobile/scripts/dev-server.mjs",
  "apps/mobile/src/camera-scanner.ts",
  "apps/mobile/src/device-container.ts",
  "apps/mobile/src/encrypted-capture.ts",
  "apps/mobile/src/expo-storage.ts",
  "apps/mobile/src/file-vault-storage.ts",
  "apps/mobile/src/local-network-transport.ts",
  "apps/mobile/src/near-field-endpoint.ts",
  "apps/mobile/src/pairing-client.ts",
  "apps/mobile/src/pairing-workflow.ts",
  "apps/mobile/src/runtime.ts",
  "apps/mobile/src/runtime-state-storage.ts",
  "apps/mobile/src/ocr-capture-workflow.ts",
  "apps/mobile/src/sync-session.ts",
  "apps/mobile/src/view-state.ts",
  "apps/tablet/package.json",
  "apps/tablet/prototype/index.html",
  "apps/tablet/scripts/app-state.mjs",
  "apps/tablet/scripts/dev-server.mjs",
  "packages/vault-core/src/index.ts",
  "packages/vault-core/src/constants.ts",
  "packages/vault-core/src/categories.ts",
  "packages/vault-core/src/templates.ts",
  "packages/vault-core/src/manifest.ts",
  "packages/vault-core/src/drafts.ts",
  "packages/vault-core/src/records.ts",
  "packages/vault-core/src/reminders.ts",
  "packages/vault-core/src/reminder-engine.ts",
  "packages/vault-core/src/reminder-notifications.ts",
  "packages/vault-core/src/terminal-notifications.ts",
  "packages/vault-core/src/attachments.ts",
  "packages/vault-core/src/repository.ts",
  "packages/vault-core/src/storage.ts",
  "packages/vault-core/src/sqlite.ts",
  "packages/vault-core/src/vault-package.ts",
  "packages/vault-core/src/search.ts",
  "packages/vault-core/src/utils.ts",
  "packages/vault-core/schemas/record-template.schema.json",
  "packages/vault-core/schemas/vault-manifest.schema.json",
  "packages/crypto-core/src/index.ts",
  "packages/crypto-core/src/attachment-encryption.ts",
  "packages/crypto-core/src/conformance.ts",
  "packages/crypto-core/src/development.ts",
  "packages/crypto-core/src/field-encryption.ts",
  "packages/crypto-core/src/native.ts",
  "packages/crypto-core/src/package-encryption.ts",
  "packages/crypto-core/src/security-policy.ts",
  "packages/crypto-core/src/vault-security.ts",
  "packages/crypto-core/src/webcrypto.ts",
  "packages/sync-core/src/index.ts",
  "packages/sync-core/src/pairing-matrix.ts",
  "packages/ocr-core/src/index.ts",
  "packages/ocr-core/src/heuristics.ts",
  "packages/ui/src/index.ts"
];

const packageFiles = [
  "package.json",
  "apps/desktop/package.json",
  "apps/mobile/package.json",
  "packages/vault-core/package.json",
  "packages/crypto-core/package.json",
  "packages/sync-core/package.json",
  "packages/ocr-core/package.json",
  "packages/ui/package.json"
];

const schemaFiles = [
  "packages/vault-core/schemas/record-template.schema.json",
  "packages/vault-core/schemas/vault-manifest.schema.json"
];

const expectedRecordTypes = [
  "account",
  "bank_card",
  "membership",
  "identity_document",
  "secret_key",
  "custom"
];

const failures = [];

function readText(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function assertTextOrder(text, first, second, message) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  assert(firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex, message);
}

function collectFiles(dir, predicate, files = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const relativePath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectFiles(relativePath, predicate, files);
    } else if (predicate(relativePath)) {
      files.push(relativePath);
    }
  }
  return files;
}

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `Missing required file: ${file}`);
}

for (const file of packageFiles) {
  try {
    const parsed = JSON.parse(readText(file));
    assert(Boolean(parsed.name), `Package file has no name: ${file}`);
  } catch (error) {
    failures.push(`Invalid package JSON: ${file} (${error.message})`);
  }
}

for (const file of schemaFiles) {
  try {
    const parsed = JSON.parse(readText(file));
    assert(parsed.$schema?.includes("2020-12"), `Schema should use draft 2020-12: ${file}`);
    assert(parsed.type === "object", `Schema should describe an object: ${file}`);
  } catch (error) {
    failures.push(`Invalid schema JSON: ${file} (${error.message})`);
  }
}

assert(!existsSync(join(root, "apps/web")), "apps/web must not exist for the terminal-device MVP");
assert(!existsSync(join(root, "apps/pwa")), "apps/pwa must not exist for the terminal-device MVP");

const rootPackage = JSON.parse(readText("package.json"));
assert(
  Array.isArray(rootPackage.workspaces) && rootPackage.workspaces.includes("apps/*") && rootPackage.workspaces.includes("packages/*"),
  "Root package.json should include apps/* and packages/* workspaces"
);
assert(rootPackage.packageManager === "pnpm@11.5.2", "Root package.json should pin pnpm packageManager");
assert(readText("pnpm-lock.yaml").includes("lockfileVersion: '9.0'"), "pnpm lockfile should use lockfile v9");
assert(readText("pnpm-workspace.yaml").includes("apps/*"), "pnpm workspace should include apps/*");
assert(readText("pnpm-workspace.yaml").includes("packages/*"), "pnpm workspace should include packages/*");
assert(rootPackage.scripts?.["demo:current"], "Root package.json should include current product demo script");
assert(rootPackage.scripts?.["terminal:previews"], "Root package.json should include terminal previews script");
assert(rootPackage.scripts?.["terminal:previews:detached"], "Root package.json should include detached terminal previews script");
assert(rootPackage.scripts?.["terminal:app-windows"], "Root package.json should include terminal app windows script");
assert(rootPackage.scripts?.["terminal:previews:check"], "Root package.json should include terminal preview health check script");
assert(rootPackage.scripts?.["readiness:report"], "Root package.json should include readiness report script");
assert(rootPackage.scripts?.["preview:package"], "Root package.json should include usable preview package script");
assert(rootPackage.scripts?.["preview:reset"], "Root package.json should include preview reset script");
assert(rootPackage.scripts?.["acceptance:usable-preview"], "Root package.json should include usable preview acceptance script");
assert(rootPackage.scripts?.["terminal:previews:open"], "Root package.json should include terminal previews open script");
assert(rootPackage.scripts?.["desktop:native"], "Root package.json should include desktop native shell script");
assert(rootPackage.scripts?.["desktop:start"], "Root package.json should include desktop preview start script");
assert(rootPackage.scripts?.["desktop:dev"], "Root package.json should include desktop dev script");
assert(rootPackage.scripts?.["desktop:check"], "Root package.json should include desktop check script");
assert(rootPackage.scripts?.["mobile:dev"], "Root package.json should include mobile dev script");
assert(rootPackage.scripts?.["mobile:preview"], "Root package.json should include mobile preview script");
assert(rootPackage.scripts?.["tablet:dev"], "Root package.json should include tablet dev script");
assert(rootPackage.scripts?.["tablet:preview"], "Root package.json should include tablet preview script");
assert(rootPackage.scripts?.["smoke:native-crypto"], "Root package.json should include native crypto smoke script");
assert(rootPackage.scripts?.["smoke:desktop-app-shell"], "Root package.json should include desktop app shell smoke script");
assert(rootPackage.scripts?.["smoke:desktop-native-shell"], "Root package.json should include desktop native shell smoke script");
assert(rootPackage.scripts?.["smoke:desktop-notification-bridge"], "Root package.json should include desktop notification bridge smoke script");
assert(rootPackage.scripts?.["smoke:desktop-sqlite-backup-restore"], "Root package.json should include desktop SQLite backup restore smoke script");
assert(rootPackage.scripts?.["smoke:desktop-sqlite-runtime"], "Root package.json should include desktop SQLite runtime smoke script");
assert(rootPackage.scripts?.["smoke:desktop-sqlite-shell"], "Root package.json should include desktop SQLite shell smoke script");
assert(rootPackage.scripts?.["smoke:desktop-sqlite-sync-state"], "Root package.json should include desktop SQLite sync state smoke script");
assert(rootPackage.scripts?.["smoke:atomic-file-storage"], "Root package.json should include atomic file storage smoke script");
assert(rootPackage.scripts?.["smoke:app-runtimes"], "Root package.json should include app runtime smoke script");
assert(rootPackage.scripts?.["smoke:desktop-backup-restore"], "Root package.json should include desktop backup restore smoke script");
assert(rootPackage.scripts?.["smoke:desktop-reminder-state"], "Root package.json should include desktop reminder state smoke script");
assert(rootPackage.scripts?.["smoke:device-identity"], "Root package.json should include device identity smoke script");
assert(rootPackage.scripts?.["smoke:mobile-app-shell"], "Root package.json should include mobile app shell smoke script");
assert(rootPackage.scripts?.["smoke:mobile-camera-scanner"], "Root package.json should include mobile camera scanner smoke script");
assert(rootPackage.scripts?.["smoke:mobile-camera-capture-session"], "Root package.json should include mobile camera capture session smoke script");
assert(rootPackage.scripts?.["smoke:mobile-expo-storage"], "Root package.json should include mobile Expo storage smoke script");
assert(rootPackage.scripts?.["smoke:mobile-pairing-client"], "Root package.json should include mobile pairing client smoke script");
assert(rootPackage.scripts?.["smoke:mobile-runtime-state"], "Root package.json should include mobile runtime state smoke script");
assert(rootPackage.scripts?.["smoke:tablet-app-shell"], "Root package.json should include tablet app shell smoke script");
assert(rootPackage.scripts?.["smoke:terminal-shells"], "Root package.json should include terminal shell smoke script");
assert(rootPackage.scripts?.["smoke:terminal-app-windows"], "Root package.json should include terminal app window smoke script");
assert(rootPackage.scripts?.["smoke:terminal-discovery-shells"], "Root package.json should include terminal discovery shell smoke script");
assert(rootPackage.scripts?.["smoke:discovery-candidate-actions"], "Root package.json should include discovery candidate action smoke script");
assert(rootPackage.scripts?.["smoke:terminal-previews-detached"], "Root package.json should include detached terminal preview smoke script");
assert(rootPackage.scripts?.["smoke:package-usable-preview"], "Root package.json should include usable preview package smoke script");
assert(rootPackage.scripts?.["smoke:reset-preview-state"], "Root package.json should include reset preview state smoke script");
assert(rootPackage.scripts?.["smoke:pairing-matrix"], "Root package.json should include pairing matrix smoke script");
assert(rootPackage.scripts?.["smoke:reminder-notifications"], "Root package.json should include reminder notification smoke script");
assert(rootPackage.scripts?.["smoke:terminal-notifications"], "Root package.json should include terminal notification smoke script");
assert(rootPackage.scripts?.["smoke:runtime-reminder-notifications"], "Root package.json should include runtime reminder notification smoke script");
assert(rootPackage.scripts?.["smoke:runtime-terminal-notifications"], "Root package.json should include runtime terminal notification smoke script");
assert(rootPackage.scripts?.["smoke:runtime-native-crypto"], "Root package.json should include runtime native crypto smoke script");
assert(rootPackage.scripts?.["smoke:near-field-discovery"], "Root package.json should include near-field discovery smoke script");
assert(rootPackage.scripts?.["smoke:near-field-connection-state"], "Root package.json should include near-field connection state smoke script");
assert(rootPackage.scripts?.["smoke:near-field-probe"], "Root package.json should include near-field endpoint probe smoke script");
assert(rootPackage.scripts?.["smoke:bluetooth-sync-envelope"], "Root package.json should include bluetooth sync envelope smoke script");
assert(rootPackage.scripts?.["smoke:sync-failure-receipts"], "Root package.json should include sync failure receipt smoke script");
assert(rootPackage.scripts?.["smoke:sync-receipt-summary"], "Root package.json should include sync receipt summary smoke script");
assert(rootPackage.scripts?.["smoke:sync-delete-propagation"], "Root package.json should include sync delete propagation smoke script");
assert(rootPackage.scripts?.["smoke:sync-manual-merge-vault"], "Root package.json should include manual merge vault smoke script");
assert(rootPackage.scripts?.["smoke:sync-paired-device-key"], "Root package.json should include paired-device sync key smoke script");
assert(rootPackage.scripts?.["smoke:sync-tablet-to-desktop"], "Root package.json should include tablet-to-desktop sync smoke script");
assert(rootPackage.scripts?.["smoke:sync-trust-gate"], "Root package.json should include sync trust gate smoke script");
assert(rootPackage.scripts?.["smoke:vault-security"], "Root package.json should include vault security smoke script");
const syncPackage = JSON.parse(readText("packages/sync-core/package.json"));
assert(syncPackage.dependencies?.["qrcode-generator"], "sync-core package should depend on the standard QR encoder");

const templatesText = readText("packages/vault-core/src/templates.ts");
for (const type of expectedRecordTypes) {
  assert(templatesText.includes(`type: "${type}"`), `Missing record template: ${type}`);
}

assert(!/cvv/i.test(templatesText), "Bank card template must not include CVV by default");
assert(templatesText.includes("reminderCandidate"), "At least one template field should support reminders");
assert(templatesText.includes('sensitivity: "critical"'), "Templates should include critical sensitivity fields");

const vaultIndex = readText("packages/vault-core/src/index.ts");
for (const type of expectedRecordTypes) {
  assert(vaultIndex.includes(`| "${type}"`) || vaultIndex.includes(`= "${type}"`), `RecordType union missing ${type}`);
}
assert(readText("packages/vault-core/src/constants.ts").includes("VAULT_SCHEMA_VERSION = 1"), "Vault schema version should be 1");
assert(vaultIndex.includes("createVaultManifest"), "vault-core should export createVaultManifest");
assert(vaultIndex.includes("createRecordDraft"), "vault-core should export createRecordDraft");
assert(vaultIndex.includes("createVaultRecord"), "vault-core should export createVaultRecord");
assert(vaultIndex.includes("createVaultRecordAsync"), "vault-core should export async record creation");
assert(vaultIndex.includes("InMemoryVaultRepository"), "vault-core should export InMemoryVaultRepository");
assert(vaultIndex.includes("InMemoryVaultStorageAdapter"), "vault-core should export InMemoryVaultStorageAdapter");
assert(vaultIndex.includes("updateVaultRecordFields"), "vault-core should export updateVaultRecordFields");
assert(vaultIndex.includes("updateVaultRecordFieldsAsync"), "vault-core should export async field updates");
assert(vaultIndex.includes("addRecordAttachment"), "vault-core should export addRecordAttachment");
assert(vaultIndex.includes("getDueReminderAlerts"), "vault-core should export reminder alert helpers");
assert(vaultIndex.includes("ReminderNotificationCenter"), "vault-core should export reminder notification center");
assert(vaultIndex.includes("parseReminderNotificationState"), "vault-core should export reminder notification state parsing");
assert(vaultIndex.includes("createVaultPackage"), "vault-core should export createVaultPackage");
assert(vaultIndex.includes("createVaultPackageAsync"), "vault-core should export async vault package creation");
assert(vaultIndex.includes("restoreSnapshotFromVaultPackageAsync"), "vault-core should export async vault package restore");
assert(vaultIndex.includes("initializeSqliteVaultSchema"), "vault-core should export initializeSqliteVaultSchema");
assert(vaultIndex.includes("SqliteVaultStorageAdapter"), "vault-core should export SqliteVaultStorageAdapter");
assert(vaultIndex.includes("createTag"), "vault-core should export createTag");
assert(vaultIndex.includes("searchRecords"), "vault-core should export searchRecords");
assert(readText("packages/vault-core/src/sqlite.ts").includes("CREATE TABLE IF NOT EXISTS records"), "SQLite schema should include records table");
assert(readText("packages/vault-core/src/sqlite.ts").includes("persistVaultSnapshotRows"), "SQLite adapter should persist normalized vault rows");
assert(readText("packages/vault-core/src/sqlite.ts").includes("INSERT OR REPLACE INTO record_fields"), "SQLite adapter should persist field rows");
assert(readText("packages/vault-core/src/sqlite.ts").includes("INSERT OR REPLACE INTO attachments"), "SQLite adapter should persist attachment rows");
assert(readText("packages/vault-core/src/sqlite.ts").includes("INSERT OR REPLACE INTO reminders"), "SQLite adapter should persist reminder rows");
assert(readText("tools/smoke-sqlite-adapter.mjs").includes("record field row insert") && readText("tools/smoke-sqlite-adapter.mjs").includes("attachment row insert") && readText("tools/smoke-sqlite-adapter.mjs").includes("reminder row insert"), "SQLite smoke should verify normalized row persistence");
assert(readText("packages/vault-core/src/vault-package.ts").includes("loginto-vault-package-v1"), "Vault package format should be versioned");
assert(readText("packages/vault-core/src/search.ts").includes("secret"), "Search should account for sensitive fields");
assert(readText("packages/vault-core/src/reminder-notifications.ts").includes("snoozed"), "Reminder notifications should support snooze state");
assert(vaultIndex.includes("deliverTerminalReminderNotifications"), "Vault core should export terminal reminder notification delivery bridge");
assert(readText("packages/vault-core/src/terminal-notifications.ts").includes("requestPermission"), "Terminal notification bridge should model OS notification permission");
assert(readText("packages/vault-core/src/terminal-notifications.ts").includes("showReminder"), "Terminal notification bridge should model platform reminder display");
assert(readText("tools/smoke-terminal-notification-bridge.mjs").includes("permission-denied"), "Terminal notification smoke should cover denied permission");
assert(readText("apps/desktop/src/runtime.ts").includes("deliverDueTerminalReminderNotifications"), "Desktop runtime should expose terminal reminder notification dispatch");
assert(readText("apps/mobile/src/runtime.ts").includes("deliverDueTerminalReminderNotifications"), "Mobile runtime should expose terminal reminder notification dispatch");
assert(readText("tools/smoke-runtime-terminal-notifications.mjs").includes("desktopAfterReload"), "Runtime terminal notification smoke should verify persisted dedupe after reload");

const cryptoIndex = readText("packages/crypto-core/src/index.ts");
assert(cryptoIndex.includes("argon2id"), "crypto-core should define argon2id KDF");
assert(cryptoIndex.includes("pbkdf2-sha256"), "crypto-core should define WebCrypto PBKDF2 fallback KDF");
assert(cryptoIndex.includes("xchacha20-poly1305"), "crypto-core should prefer XChaCha20-Poly1305");
assert(readText("packages/crypto-core/src/security-policy.ts").includes("requiresSecondUnlock"), "crypto-core should define second-unlock policy");
assert(cryptoIndex.includes("VaultSecuritySession"), "crypto-core should expose vault security session");
assert(cryptoIndex.includes("createUnsafeDevelopmentFieldEncryptor"), "crypto-core should expose the unsafe development field encryptor");
assert(cryptoIndex.includes("createUnsafeDevelopmentPackageEncryptor"), "crypto-core should expose the unsafe development package encryptor");
assert(cryptoIndex.includes("assertCryptoAdapterConformance"), "crypto-core should expose adapter conformance checks");
assert(cryptoIndex.includes("createWebCryptoAesGcmAdapter"), "crypto-core should expose WebCrypto AES-GCM adapter");
assert(cryptoIndex.includes("createNativeXChaCha20Poly1305Adapter"), "crypto-core should expose native XChaCha20-Poly1305 adapter boundary");
assert(cryptoIndex.includes("NativeCryptoProvider"), "crypto-core should expose the native provider interface");
assert(cryptoIndex.includes("createCryptoFieldEncryptor"), "crypto-core should expose crypto field encryptor");
assert(cryptoIndex.includes("encryptAttachmentBlob"), "crypto-core should expose attachment blob encryption");
assert(cryptoIndex.includes("createCryptoPackageEncryptor"), "crypto-core should expose package encryption");
assert(readText("packages/crypto-core/src/attachment-encryption.ts").includes("loginto-attachment-cipher-v1"), "Attachment cipher format should be versioned");
assert(readText("packages/crypto-core/src/package-encryption.ts").includes("backup-package"), "Package encryption should support backup packages");
assert(readText("packages/crypto-core/src/webcrypto.ts").includes("AES-GCM"), "WebCrypto adapter should use AES-GCM");
assert(readText("packages/crypto-core/src/native.ts").includes("deriveArgon2idKey"), "Native crypto adapter should require Argon2id key derivation");
assert(readText("packages/crypto-core/src/native.ts").includes("encryptXChaCha20Poly1305"), "Native crypto adapter should require XChaCha20-Poly1305 encryption");
assert(readText("packages/crypto-core/src/native.ts").includes("nonce.length !== 24"), "Native crypto adapter should require 24-byte XChaCha nonces");
assert(readText("tools/smoke-native-crypto-adapter.mjs").includes("xchacha20-poly1305"), "Native crypto smoke should verify XChaCha payload metadata");
assert(readText("tools/smoke-runtime-native-crypto.mjs").includes("cryptoAdapter: nativeAdapter"), "Runtime native crypto smoke should inject native adapters into app runtimes");
assert(readText("packages/crypto-core/src/field-encryption.ts").includes("loginto-field-cipher-v1"), "Field cipher format should be versioned");
assert(readText("packages/crypto-core/src/vault-security.ts").includes("second-unlock-required"), "Vault security should enforce second unlock");

const syncIndex = readText("packages/sync-core/src/index.ts");
assert(syncIndex.includes("loginto-pairing-v1"), "sync-core should define pairing protocol");
assert(syncIndex.includes("SyncConflict"), "sync-core should define sync conflicts");
assert(syncIndex.includes("createPairingPayload"), "sync-core should create pairing payloads");
assert(syncIndex.includes("FaceToFacePairingSession"), "sync-core should expose face-to-face pairing workflow");
assert(syncIndex.includes("encodePairingPayloadMatrix"), "sync-core should expose pairing matrix encoder");
assert(syncIndex.includes("encodePairingPayloadQr"), "sync-core should expose standard QR encoder for pairing payloads");
assert(syncIndex.includes("decodePairingPayloadText"), "sync-core should decode scanned QR payload text");
assert(readText("packages/sync-core/src/pairing-matrix.ts").includes("decodePairingPayloadMatrix"), "sync-core should decode pairing matrix payloads");
assert(readText("packages/sync-core/src/pairing-matrix.ts").includes("loginto-pairing-qr-v1"), "sync-core should version the standard pairing QR format");
assert(readText("packages/sync-core/src/pairing-matrix.ts").includes("qrcode-generator"), "sync-core should use a standard QR encoder implementation");
assert(syncIndex.includes("summarizeSyncChanges"), "sync-core should summarize sync changes");
assert(syncIndex.includes("createSyncMergePlan"), "sync-core should create sync merge plans");
assert(syncIndex.includes("resolveSyncConflict"), "sync-core should resolve sync conflicts");
assert(syncIndex.includes("manual-merge"), "sync-core should support manual sync conflict merge decisions");
assert(syncIndex.includes("SyncFieldMergeChoice"), "sync-core should model field-level manual merge choices");
assert(syncIndex.includes("findSyncConflictDecision"), "sync-core should map preview conflict decisions to runtime conflict ids");
assert(syncIndex.includes("SyncChangeLog"), "sync-core should expose sync change log");
assert(syncIndex.includes("TrustedDeviceStore"), "sync-core should expose trusted device store");
assert(syncIndex.includes("createSyncExchangePackage"), "sync-core should create sync exchange packages");
assert(syncIndex.includes("EncryptedSyncExchangePackage"), "sync-core should define encrypted sync exchange packages");
assert(syncIndex.includes("encryptSyncExchangePackage"), "sync-core should encrypt sync exchange packages");
assert(syncIndex.includes("decryptSyncExchangePackage"), "sync-core should decrypt sync exchange packages");
assert(syncIndex.includes("createEncryptedSyncExchangeAad"), "sync-core should bind encrypted sync exchange metadata as AAD");
assert(syncIndex.includes("contentDigest"), "sync-core exchange packages should include a content digest");
assert(syncIndex.includes("createSyncExchangeContentDigest"), "sync-core should verify exchange package content digests");
assert(syncIndex.includes("expectedConfirmationId"), "sync-core should support confirmation-bound exchange package receive");
assert(syncIndex.includes("hasImportedPackage"), "sync-core should reject repeated exchange package imports");
assert(syncIndex.includes("createMergePlanFromExchange"), "sync-core should merge from sync exchange packages");
assert(syncIndex.includes("applySyncMergePlan"), "sync-core should apply sync merge plans");
assert(syncIndex.includes("SyncImportJournal"), "sync-core should track sync import journal entries");
assert(syncIndex.includes("NearFieldSyncSession"), "sync-core should expose near-field sync session");
assert(syncIndex.includes("NearFieldDiscoveryCandidate"), "sync-core should expose near-field discovery candidates");
assert(syncIndex.includes("createNearFieldDiscoveryCandidate"), "sync-core should create near-field discovery candidates");
assert(syncIndex.includes("createNearFieldDiscoverySnapshot"), "sync-core should create near-field discovery snapshots");
assert(syncIndex.includes("probeNearFieldEndpoint"), "sync-core should probe near-field terminal endpoints");
assert(syncIndex.includes("createNearFieldEndpointProbeTargets"), "sync-core should create endpoint probe targets from scan plans");
assert(syncIndex.includes("createHotspotDirectEndpointProbeTargets"), "sync-core should create hotspot direct endpoint probe targets");
assert(syncIndex.includes("createNearFieldDiscoverySnapshotFromProbeTargets"), "sync-core should build discovery snapshots from endpoint probes");
assert(syncIndex.includes("createNearFieldTransportPlan"), "sync-core should expose a near-field transport plan");
assert(syncIndex.includes("NearFieldConnectionState") && syncIndex.includes("createNearFieldConnectionState"), "sync-core should expose near-field connection state summaries");
assert(syncIndex.includes('"waiting-confirmation"') && syncIndex.includes('"offline"'), "near-field connection state should model waiting confirmation and offline peers");
assert(syncIndex.includes('"connecting"') && syncIndex.includes('"waiting-peer"') && syncIndex.includes('"timed-out"') && syncIndex.includes('"peer-rejected"') && syncIndex.includes('"recovered"'), "near-field connection state should model connecting, peer wait, timeout, rejection, and recovery");
assert(syncIndex.includes("createBluetoothSyncExchangeEnvelope"), "sync-core should create bluetooth sync exchange envelopes");
assert(syncIndex.includes("parseBluetoothSyncExchangeEnvelope"), "sync-core should parse bluetooth sync exchange envelopes");
assert(syncIndex.includes("loginto-bluetooth-sync-envelope-v1"), "sync-core should version bluetooth sync envelopes");
assert(syncIndex.includes("publicNetworkLogin: false"), "near-field transport plan should reject public-network login");
assert(syncIndex.includes("requiresFaceToFaceTrust"), "near-field transport channels should require face-to-face trust");
assert(syncIndex.includes("createNearFieldEndpointDescriptor"), "sync-core should create near-field endpoint descriptors");
assert(syncIndex.includes("createNearFieldRequest"), "sync-core should create near-field requests");
assert(syncIndex.includes("handleNearFieldRequest"), "sync-core should handle near-field endpoint requests");
assert(syncIndex.includes("NearFieldTransportAdapter"), "sync-core should define near-field transport adapter boundary");
assert(syncIndex.includes("InMemoryNearFieldTransportAdapter"), "sync-core should expose in-memory near-field transport");
assert(syncIndex.includes("sendNearFieldRequest"), "sync-core should send near-field requests through transport adapters");
assert(syncIndex.includes("responder device id mismatch"), "sync-core should reject near-field responses from the wrong device");
assert(readText("apps/desktop/src/near-field-endpoint.ts").includes("createDesktopNearFieldEndpoint"), "desktop app should expose near-field endpoint boundary");
assert(readText("apps/desktop/prototype/index.html").includes("会员到期提醒"), "desktop prototype should show reminder popup UI");
assert(readText("apps/desktop/prototype/index.html").includes("提醒中心"), "desktop prototype should show a reminder center");
assert(!readText("apps/desktop/prototype/index.html").includes("宸插彇"), "desktop prototype should not contain garbled Chinese sync cancel copy");
assert(readText("apps/desktop/prototype/index.html").includes("data-backup-panel"), "desktop prototype should show a local backup panel");
assert(readText("apps/desktop/prototype/index.html").includes('data-action="backup-export"'), "desktop prototype should expose encrypted backup export");
assert(readText("apps/desktop/prototype/index.html").includes('data-action="backup-verify"'), "desktop prototype should expose backup restore verification");
assert(readText("apps/desktop/prototype/index.html").includes("data-backup-confirm"), "desktop prototype should require explicit confirmation before backup export");
assert(readText("apps/desktop/prototype/index.html").includes("backupConfirm.checked"), "desktop prototype should block backup export until the user confirms");
assert(readText("apps/desktop/prototype/index.html").includes("data-security-panel"), "desktop prototype should show local vault security status");
assert(readText("apps/desktop/prototype/index.html").includes("data-security-lock-state"), "desktop prototype should show vault lock state");
assert(readText("apps/desktop/prototype/index.html").includes("data-security-second-unlock"), "desktop prototype should show second-unlock status");
assert(readText("apps/desktop/prototype/index.html").includes("data-security-copy-clear"), "desktop prototype should show clipboard clear timing");
assert(readText("apps/desktop/prototype/index.html").includes("renderSecurityPanel"), "desktop prototype should render vault security state from app-state");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("security: runtime.security.snapshot"), "desktop app-state should expose vault security snapshot");
assert(readText("apps/desktop/prototype/index.html").includes("/api/app-state"), "desktop prototype should load local app-state API");
assert(readText("apps/desktop/prototype/index.html").includes("/api/backup/export"), "desktop prototype should call local backup export API");
assert(readText("apps/desktop/prototype/index.html").includes("/api/backup/verify"), "desktop prototype should call local backup verify API");
assert(readText("apps/desktop/prototype/index.html").includes("/api/reminders/action"), "desktop prototype should call reminder action API");
assert(readText("apps/desktop/prototype/index.html").includes("/api/reminders/dispatch"), "desktop prototype should call local reminder notification dispatch API");
assert(readText("apps/desktop/prototype/index.html").includes("/api/discovery/scan"), "desktop prototype should call near-field discovery scan API");
assert(readText("apps/desktop/prototype/index.html").includes("useLanHostScan: true"), "desktop prototype should use LAN host scan for near-field discovery");
assert(readText("apps/desktop/prototype/index.html").includes("ports: [4177, 4178]"), "desktop prototype should scan phone and tablet preview ports");
assert(readText("apps/desktop/prototype/index.html").includes("data-near-field-candidates"), "desktop prototype should show near-field discovery candidates");
assert(readText("apps/desktop/prototype/index.html").includes("data-candidate-reason"), "desktop prototype should explain why a near-field candidate needs pairing or re-pairing");
assert(readText("apps/desktop/prototype/index.html").includes("data-discovery-probes"), "desktop prototype should show near-field probe diagnostics");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-connection-state") && readText("apps/desktop/prototype/index.html").includes("renderDesktopConnectionState"), "desktop prototype should show near-field connection state");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-reminder-tabs"), "desktop prototype should expose reminder filters");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-reminder-list"), "desktop prototype should render reminder cards");
assert(readText("apps/desktop/prototype/index.html").includes("data-notification-bridge-status"), "desktop prototype should show notification bridge status");
assert(readText("apps/desktop/prototype/index.html").includes('data-reminder-action="complete"'), "desktop prototype should support completing a reminder from the center");
assert(readText("apps/desktop/prototype/index.html").includes('data-reminder-action="snooze"'), "desktop prototype should support snoozing a reminder from the center");
assert(readText("apps/desktop/prototype/index.html").includes('data-reminder-action="dismiss"'), "desktop prototype should support dismissing a reminder from the center");
assert(readText("apps/desktop/prototype/index.html").includes('data-modal-action="dismiss"'), "desktop reminder popup should support dismissing from the popup");
assert(readText("apps/desktop/prototype/index.html").includes("data-reminder-status-detail"), "desktop prototype should show reminder action status details");
assert(readText("apps/desktop/prototype/index.html").includes("formatReminderStatusDetail"), "desktop prototype should format reminder completion and snooze details");
assert(readText("apps/desktop/prototype/index.html").includes("/api/records"), "desktop prototype should call record creation API");
assert(readText("apps/desktop/prototype/index.html").includes("deleteBtn"), "desktop prototype should expose record deletion control");
assert(readText("apps/desktop/prototype/index.html").includes("editBtn"), "desktop prototype should expose record editing control");
assert(readText("apps/desktop/prototype/index.html").includes("/api/fields/reveal"), "desktop prototype should call sensitive field reveal API");
assert(readText("apps/desktop/prototype/index.html").includes("/api/pairing/start"), "desktop prototype should call local pairing start API");
assert(!readText("apps/desktop/prototype/index.html").includes("模拟手机确认"), "desktop prototype should not expose simulated phone confirmation as a user action");
assert(readText("apps/desktop/prototype/index.html").includes("recordForm"), "desktop prototype should include a form-driven record creation modal");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createDesktopShellAppState"), "desktop shell should build app-state from local modules");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createDesktopRuntime"), "desktop shell app-state should load the real desktop runtime");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("applyDesktopShellReminderAction"), "desktop shell should expose reminder action handler");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("dispatchDesktopShellReminderNotifications"), "desktop shell should expose reminder notification dispatch");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("notificationBridge"), "desktop app-state should expose notification bridge status");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createDesktopShellNearFieldDiscovery"), "desktop shell should expose near-field discovery scan");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("resolveDesktopShellDiscoveryCandidateAction"), "desktop shell should resolve near-field candidate actions");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createNearFieldEndpointProbeTargets"), "desktop shell should create probe targets from scan plans");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("getDesktopLocalNetworkEndpointScanTargets"), "desktop shell should derive LAN scan targets from local network interfaces");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createNearFieldDiscoverySnapshot"), "desktop shell discovery should use sync-core discovery snapshots");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createNearFieldDiscoverySnapshotFromProbeTargets"), "desktop shell discovery should probe terminal endpoints");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("transportPlan"), "desktop shell discovery should expose the shared transport plan");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createNearFieldConnectionState") && readText("apps/desktop/scripts/app-state.mjs").includes("connectionState"), "desktop shell should expose near-field connection state");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createDesktopReminderCenter"), "desktop shell should expose a reminder center view model");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("lastStatusAt") && readText("apps/desktop/scripts/app-state.mjs").includes("snoozedUntil"), "desktop reminder center should expose persisted action status details");
assert(readText("apps/desktop/scripts/notification-bridge.mjs").includes("createDesktopReminderNotificationAdapter"), "desktop notification bridge should expose a terminal notification adapter");
assert(readText("apps/desktop/scripts/notification-bridge.mjs").includes("desktop-reminder-notification-dispatches.jsonl"), "desktop notification bridge should persist dispatch logs locally");
assert(readText("apps/desktop/scripts/notification-bridge.mjs").includes("ToastNotificationManager"), "desktop notification bridge should attempt Windows toast delivery");
assert(readText("tools/smoke-desktop-notification-bridge.mjs").includes("Desktop notification bridge smoke test passed"), "desktop notification bridge smoke should verify dispatch and dedupe");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("exportDesktopShellBackupPackage"), "desktop shell should expose encrypted backup export");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("verifyDesktopShellBackupPackage"), "desktop shell should expose backup restore verification");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createDesktopShellRecord"), "desktop shell should expose record creation handler");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("revealDesktopShellFields"), "desktop shell should expose sensitive field reveal handler");
assert(readText("apps/desktop/src/runtime.ts").includes("revealFieldValue") && readText("apps/desktop/src/runtime.ts").includes("decryptCryptoFieldValue"), "desktop runtime should decrypt sensitive reveals from encrypted vault fields");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("runtime.revealFieldValue") && !readText("apps/desktop/scripts/app-state.mjs").includes("secretValue"), "desktop app-state should not carry seed UI secretValue");
assert(!readText("apps/desktop/prototype/index.html").includes("secretValue"), "desktop prototype should not embed sensitive fallback secretValue");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("remote-pairing-payload-required") && readText("apps/desktop/scripts/app-state.mjs").includes("pairing-code-required"), "desktop pairing confirm should require a remote payload and six-digit code");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("requireLocalPeerBaseUrl(remotePayload.localEndpoint, \"pairing peer\")"), "desktop pairing confirm should reject public-network peer endpoints");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("requireLocalPeerBaseUrl(scannedTarget.descriptor.baseUrl, \"pairing peer\")"), "mobile QR pairing trust should reject public-network peer endpoints");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("requireLocalPeerBaseUrl(payload.localEndpoint, \"pairing peer\")"), "tablet QR pairing trust should reject public-network peer endpoints");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("Tablet desktop trust requires a pairing QR payload"), "tablet QR pairing trust should require a QR payload");
assert(!readText("apps/tablet/scripts/app-state.mjs").includes("explicit trusted-device identity"), "tablet QR pairing trust must not accept direct trusted-device identities");
assert(!readText("apps/desktop/scripts/app-state.mjs").includes("input.remotePairingPayload ?? createDefaultPhonePairingPayload"), "desktop pairing confirm should not trust a default simulated phone");
assert(readText("apps/mobile/src/runtime.ts").includes("createRecord") && readText("apps/mobile/src/runtime.ts").includes("decryptCryptoFieldValue"), "mobile runtime should own encrypted record writes and field decrypts");
assert(!readText("apps/mobile/scripts/app-state.mjs").includes("createUnsafeDevelopmentFieldEncryptor"), "mobile app-state should not write vault fields with the unsafe development encryptor");
assert(!readText("apps/tablet/scripts/app-state.mjs").includes("createUnsafeDevelopmentFieldEncryptor"), "tablet app-state should not write vault fields with the unsafe development encryptor");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createDesktopShellPairingPreview"), "desktop shell should expose pairing preview handler");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("encodePairingPayloadQr"), "desktop shell pairing preview should expose standard QR payloads");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("confirmDesktopShellPairing"), "desktop shell should expose pairing confirmation handler");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-pairing-payload") && readText("apps/desktop/prototype/index.html").includes("data-desktop-pairing-copy"), "desktop shell should expose a copyable QR payload for face-to-face pairing");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("persist vault and runtime-state files"), "desktop app shell smoke should verify persisted runtime files");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("completed status"), "desktop app shell smoke should verify completed reminder actions");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("snoozed status"), "desktop app shell smoke should verify snoozed reminder actions");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("dismissed status"), "desktop app shell smoke should verify dismissed reminder actions");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("persist the new vault record"), "desktop app shell smoke should verify created records persist");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("UI Form Bank Card"), "desktop app shell smoke should verify form-driven typed record creation");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("PATCH"), "desktop app shell smoke should verify record editing");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("DELETE"), "desktop app shell smoke should verify record deletion");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("second-unlock-required"), "desktop app shell smoke should verify second unlock for critical fields");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("copyClearAt"), "desktop app shell smoke should verify clipboard clear plan");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("pairing start action"), "desktop app shell smoke should verify pairing start action");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("decodePairingPayloadText"), "desktop app shell smoke should verify standard QR payload decode");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("pairing confirm action"), "desktop app shell smoke should verify pairing confirm action");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("public-network peer endpoints"), "desktop app shell smoke should reject public-network pairing endpoints");
assert(readText("tools/smoke-desktop-app-shell.mjs").includes("persist trusted phone device"), "desktop app shell smoke should verify persisted trusted devices");
assert(readText("apps/desktop/prototype/index.html").includes("data-sync-target=\"phone\""), "desktop prototype should expose a phone sync push action");
assert(readText("apps/desktop/prototype/index.html").includes("data-sync-target=\"tablet\""), "desktop prototype should expose a tablet sync push action");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-sync-preview"), "desktop prototype should show sync preview confirmation details");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-sync-records"), "desktop prototype should show record-level sync preview details");
assert(readText("apps/desktop/prototype/index.html").includes("data-sync-review-records"), "desktop prototype should show a first-class sync review record list");
assert(readText("apps/desktop/prototype/index.html").includes("data-sync-review-confirm"), "desktop prototype should require an in-app sync review confirmation");
assert(readText("apps/desktop/prototype/index.html").includes("openSyncReviewDialog"), "desktop prototype should open a sync review dialog before push");
assert(!readText("apps/desktop/prototype/index.html").includes("confirm(text)"), "desktop prototype must not use confirm-style sync review");
assert(readText("apps/desktop/prototype/index.html").includes("collectConflictDecisions"), "desktop prototype should collect sync conflict decisions before apply");
assert(readText("apps/desktop/prototype/index.html").includes("data-conflict-list"), "desktop prototype should show a formal sync conflict decision list");
assert(readText("apps/desktop/prototype/index.html").includes("data-conflict-confirm"), "desktop prototype should expose a conflict decision confirmation action");
assert(readText("apps/desktop/prototype/index.html").includes("data-conflict-resolution"), "desktop prototype should emit structured conflict resolution choices");
assert(readText("apps/desktop/prototype/index.html").includes("manual-merge"), "desktop prototype should expose manual merge conflict choices");
assert(readText("apps/desktop/prototype/index.html").includes("data-manual-merge-fields"), "desktop prototype should collect field-level manual merge choices");
assert(readText("apps/desktop/prototype/index.html").includes("data-conflict-decision-summary") && readText("apps/desktop/prototype/index.html").includes("updateConflictDecisionSummary"), "desktop prototype should show live conflict decision progress");
assert(readText("apps/desktop/prototype/index.html").includes("describeConflictField") && readText("apps/desktop/prototype/index.html").includes("filterConflictFieldsForSide"), "desktop prototype should show conflict field side metadata");
assert(!readText("apps/desktop/prototype/index.html").includes("prompt("), "desktop prototype must not use prompt-style sync conflict decisions");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-sync-receipt"), "desktop prototype should show the latest sync receipt");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/status"), "desktop app shell should expose local status API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/app-state"), "desktop app shell should expose local app-state API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/discovery/scan"), "desktop app shell should expose near-field discovery scan API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/discovery/resolve"), "desktop app shell should expose near-field candidate action API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/backup/export"), "desktop app shell should expose backup export API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/backup/verify"), "desktop app shell should expose backup verify API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/reminders/action"), "desktop app shell should expose reminder action API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/reminders/dispatch"), "desktop app shell should expose reminder notification dispatch API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/records"), "desktop app shell should expose record creation API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/fields/reveal"), "desktop app shell should expose sensitive field reveal API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/pairing/start"), "desktop app shell should expose local pairing start API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("Access-Control-Allow-Origin"), "desktop pairing API should allow local preview terminals to request QR payloads across localhost ports");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/pairing/confirm"), "desktop app shell should expose local pairing confirm API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/sync/push"), "desktop shell should expose sync push API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/sync/preview"), "desktop shell should expose sync preview confirmation API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/sync/summary"), "desktop shell should expose sync summary API");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("confirmationId: confirmation.id"), "desktop shell should bind outgoing sync packages to the preview confirmation");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("sessionId: confirmation.sessionId"), "desktop shell should bind outgoing sync packages to the preview session");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("assertSyncConfirmationStillCurrent"), "desktop shell should reject stale sync previews before push");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createSyncConfirmationReview"), "desktop shell should expose a structured sync review contract");
assert(readText("apps/desktop/prototype/index.html").includes("confirmation.review"), "desktop sync review UI should read the structured review contract");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("trustedDeviceSummaries"), "desktop app-state should expose trusted device summaries");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-trusted-devices"), "desktop prototype should show trusted device summaries");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("encryptedPackage"), "desktop shell should transmit encrypted sync packages");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("Encrypted sync exchange package is required"), "desktop receive should reject plaintext sync exchange packages");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("loginto-paired-device-sync-key-v1"), "desktop shell sync key should be bound to the paired device identities");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("record-snapshot-v1"), "desktop shell should carry encrypted record snapshots inside sync packages");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("record-delete-v1"), "desktop shell should carry encrypted delete tombstones inside sync packages");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("applyRecordSyncPayloadsToDesktopVault"), "desktop shell should write applied sync record payloads into the local vault");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("findRecordConflictDecision"), "desktop shell should map preview conflict decisions before vault writeback");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("selectedRemoteOnlyFields"), "desktop shell manual merge should be able to add selected remote-only fields");
assert(readText("apps/desktop/scripts/app-state.mjs").includes('side: "remote-only"') && readText("apps/desktop/scripts/app-state.mjs").includes('key: "title"'), "desktop conflict preview should expose field side and title metadata differences");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("sentCount") && readText("apps/desktop/scripts/app-state.mjs").includes("receivedCount") && readText("apps/desktop/scripts/app-state.mjs").includes("conflictCount"), "desktop shell should persist complete sync receipt counts");
assert(readText("apps/desktop/scripts/app-state.mjs").includes('status: "success"'), "desktop shell should persist sync receipt status");
assert(readText("apps/desktop/scripts/app-state.mjs").includes('status: "failure"'), "desktop shell should persist failed sync receipt status");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("markSyncConfirmationFailed"), "desktop shell should consume failed sync confirmations");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("lastReceiptSummary"), "desktop shell should expose a stable sync receipt summary view model");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createSyncReceiveFailureError") && readText("apps/desktop/scripts/app-state.mjs").includes("errorDetail"), "desktop shell should persist structured sync failure details");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("writeJsonFileAtomically") && readText("apps/desktop/scripts/app-state.mjs").includes("writeTextFileAtomically"), "desktop shell should atomically persist local JSON state and backup packages");
assert(!readText("apps/desktop/scripts/app-state.mjs").includes("LOGINTO_SHARED_TERMINAL_VAULT_PATH"), "desktop shell must not default to a shared terminal vault");
assert(readText("apps/desktop/src/local-network-transport.ts").includes("DesktopLocalNetworkTransportAdapter"), "desktop app should expose local-network transport");
assert(readText("apps/desktop/src/local-network-transport.ts").includes("getDesktopLocalNetworkBaseUrlCandidates"), "desktop app should expose LAN base URL candidates");
assert(readText("apps/desktop/src/local-network-transport.ts").includes("getDesktopLocalNetworkHostCandidates"), "desktop app should expose LAN host candidates");
assert(readText("apps/desktop/src/local-network-transport.ts").includes("getDesktopLocalNetworkEndpointScanTargets"), "desktop app should expose LAN endpoint scan targets");
assert(readText("apps/desktop/src/local-network-transport.ts").includes("AbortSignal.timeout") && readText("apps/desktop/src/local-network-transport.ts").includes("non-JSON HTTP"), "desktop local-network transport should return structured timeout and non-JSON failures");
assert(readText("apps/desktop/src/pairing-workflow.ts").includes("createDesktopPairingSession"), "desktop app should expose pairing workflow");
assert(readText("apps/desktop/src/runtime.ts").includes("createDesktopRuntime"), "desktop app should expose runtime controller");
assert(readText("apps/desktop/src/runtime.ts").includes("restoreDesktopRuntimeFromEncryptedBackup"), "desktop runtime should restore encrypted backups");
assert(readText("apps/desktop/src/runtime.ts").includes("cryptoAdapter"), "desktop runtime should accept injected crypto adapters");
assert(readText("apps/desktop/src/runtime.ts").includes("cryptoKdfParams"), "desktop runtime should accept injected crypto KDF params");
assert(readText("apps/desktop/src/runtime.ts").includes("collectDueReminderNotifications"), "desktop runtime should collect reminder notifications");
assert(readText("apps/desktop/src/runtime.ts").includes("runtimeStateStorage"), "desktop runtime should persist local runtime state");
assert(readText("apps/desktop/src/runtime.ts").includes("trustedDevices: this.syncSession.trustedDevices.list()"), "desktop runtime should save trusted devices to runtime state");
assert(readText("apps/desktop/src/runtime.ts").includes('storageKind?: "file" | "sqlite"') && readText("apps/desktop/src/runtime.ts").includes("DesktopSqliteVaultStorageAdapter"), "desktop runtime should support SQLite vault storage");
assert(readText("apps/desktop/src/sqlite-vault-storage.ts").includes("node:sqlite") && readText("apps/desktop/src/sqlite-vault-storage.ts").includes("DesktopNodeSqliteExecutor"), "desktop app should expose a node:sqlite executor");
assert(readText("tools/smoke-desktop-sqlite-runtime.mjs").includes('storageKind: "sqlite"') && readText("tools/smoke-desktop-sqlite-runtime.mjs").includes("SELECT COUNT(*) AS count FROM records"), "desktop SQLite runtime smoke should verify normalized rows");
assert(readText("tools/smoke-desktop-sqlite-backup-restore.mjs").includes("verifyStorageKind: \"sqlite\"") && readText("tools/smoke-desktop-sqlite-backup-restore.mjs").includes("restoredRecords"), "desktop SQLite backup restore smoke should verify SQLite restore");
assert(readText("tools/smoke-desktop-sqlite-shell.mjs").includes("syncSummaryDeleted") && readText("tools/smoke-desktop-sqlite-shell.mjs").includes("syncDeletionsPath"), "desktop SQLite shell smoke should verify delete tombstones");
assert(readText("tools/smoke-desktop-sqlite-sync-state.mjs").includes("confirmationStatus") && readText("tools/smoke-desktop-sqlite-sync-state.mjs").includes("retryAction"), "desktop SQLite sync state smoke should verify confirmations, receipts, and retry recovery");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("getRuntimeVaultId(runtime)") && readText("apps/desktop/scripts/app-state.mjs").includes("syncDeletionPath"), "desktop shell should support SQLite-mode deletion tombstones without reading vault JSON");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("verifySqliteVaultPath") && readText("apps/desktop/scripts/app-state.mjs").includes("verifyStorageKind"), "desktop shell backup verification should support SQLite restore targets");
assert(readText("apps/desktop/src/runtime-state-storage.ts").includes("DesktopFileRuntimeStateStorageAdapter"), "desktop app should persist runtime state to a local file");
assert(readText("apps/desktop/src/runtime-state-storage.ts").includes("trustedDevices"), "desktop runtime state should include trusted devices");
assert(readText("apps/desktop/src/file-vault-storage.ts").includes("parseVaultSnapshot(await readFile(tempPath") && readText("apps/desktop/src/file-vault-storage.ts").includes("await rm(tempPath, { force: true })"), "desktop vault storage should verify and clean up atomic writes");
assert(readText("apps/desktop/src/runtime-state-storage.ts").includes("parseDesktopRuntimeStateSnapshot(await readFile(tempPath") && readText("apps/desktop/src/runtime-state-storage.ts").includes("await rm(tempPath, { force: true })"), "desktop runtime-state storage should verify and clean up atomic writes");
assert(readText("apps/mobile/src/near-field-endpoint.ts").includes("createMobileNearFieldEndpoint"), "mobile app should expose near-field endpoint boundary");
assert(readText("apps/mobile/src/local-network-transport.ts").includes("MobileLocalNetworkTransportAdapter"), "mobile app should expose local-network transport");
assert(readText("apps/mobile/src/local-network-transport.ts").includes("MobileHotspotDirectTransportAdapter"), "mobile app should expose hotspot direct transport");
assert(readText("apps/mobile/src/local-network-transport.ts").includes("createHotspotDirectEndpointProbeTargets"), "mobile hotspot transport should reuse sync-core hotspot target planning");
assert(readText("apps/mobile/src/local-network-transport.ts").includes("AbortSignal.timeout") && readText("apps/mobile/src/local-network-transport.ts").includes("non-JSON HTTP"), "mobile local-network transport should return structured timeout and non-JSON failures");
assert(readText("apps/mobile/src/pairing-workflow.ts").includes("createMobilePairingSession"), "mobile app should expose pairing workflow");
assert(readText("apps/mobile/src/pairing-client.ts").includes("sendMobilePairingRequest"), "mobile app should send pairing requests through transport");
assert(readText("apps/mobile/src/pairing-client.ts").includes("scanDesktopPairingMatrix"), "mobile app should scan desktop pairing matrix payloads");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createSyncReceiveFailureError") && readText("apps/mobile/scripts/app-state.mjs").includes("errorDetail"), "mobile shell should persist structured sync failure details");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("writeJsonFileAtomically"), "mobile shell should atomically persist local sync state");
assert(readText("apps/mobile/src/pairing-client.ts").includes("scanDesktopPairingQr"), "mobile app should scan standard desktop pairing QR payloads");
assert(readText("apps/mobile/src/pairing-client.ts").includes("confirmMobilePairingTrust"), "mobile app should confirm mobile pairing trust");
assert(readText("apps/mobile/src/runtime.ts").includes("createMobileRuntime"), "mobile app should expose runtime controller");
assert(readText("apps/mobile/src/runtime.ts").includes("cryptoAdapter"), "mobile runtime should accept injected crypto adapters");
assert(readText("apps/mobile/src/runtime.ts").includes("cryptoKdfParams"), "mobile runtime should accept injected crypto KDF params");
assert(readText("apps/mobile/src/runtime.ts").includes("sendPairingRequest"), "mobile runtime should expose pairing request sender");
assert(readText("apps/mobile/src/runtime.ts").includes("scanPairingMatrixAndRequest"), "mobile runtime should scan pairing matrices and send pairing requests");
assert(readText("apps/mobile/src/runtime.ts").includes("scanPairingQrAndRequest"), "mobile runtime should scan standard pairing QR payloads and send pairing requests");
assert(readText("apps/mobile/src/runtime.ts").includes("confirmPairingTrust"), "mobile runtime should expose pairing trust confirmation");
assert(readText("apps/mobile/src/runtime.ts").includes("runtimeStateStorage"), "mobile runtime should persist runtime state through an adapter");
assert(readText("apps/mobile/src/runtime.ts").includes("collectDueReminderNotifications"), "mobile runtime should collect reminder notifications");
assert(readText("apps/mobile/src/runtime-state-storage.ts").includes("MobileRuntimeStateStorageAdapter"), "mobile app should define runtime-state storage adapter");
assert(readText("apps/mobile/src/runtime-state-storage.ts").includes("MobileFileRuntimeStateStorageAdapter"), "mobile app should persist runtime state to a local file");
assert(readText("apps/mobile/src/runtime-state-storage.ts").includes("createDefaultMobileRuntimeStatePath"), "mobile app should derive a default runtime-state path from the vault path");
assert(readText("apps/mobile/src/runtime-state-storage.ts").includes("trustedDevices"), "mobile runtime state should include trusted devices");
assert(readText("apps/mobile/src/file-vault-storage.ts").includes("parseVaultSnapshot(await readFile(tempPath") && readText("apps/mobile/src/file-vault-storage.ts").includes("await rm(tempPath, { force: true })"), "mobile vault storage should verify and clean up atomic writes");
assert(readText("apps/mobile/src/runtime-state-storage.ts").includes("parseMobileRuntimeStateSnapshot(await readFile(tempPath") && readText("apps/mobile/src/runtime-state-storage.ts").includes("await rm(tempPath, { force: true })"), "mobile runtime-state storage should verify and clean up atomic writes");
assert(readText("apps/mobile/src/camera-scanner.ts").includes("MobileCameraQrScanner"), "mobile app should define a camera QR scanner boundary");
assert(readText("apps/mobile/src/camera-scanner.ts").includes("scanPairingQrWithCamera"), "mobile app should connect camera QR scans to pairing runtime");
assert(readText("apps/mobile/src/camera-scanner.ts").includes("requestPermission"), "mobile camera scanner boundary should handle camera permission");
assert(readText("apps/mobile/src/device-container.ts").includes("createDeviceContainerProfile"), "mobile app should expose a reusable device container profile");
assert(readText("apps/mobile/src/device-container.ts").includes("publicNetworkLogin: false"), "device container should explicitly reject public-network login");
assert(readText("apps/mobile/src/device-container.ts").includes("createNearFieldTransportPlan"), "device container should reuse the shared near-field transport plan");
assert(readText("apps/mobile/src/device-container.ts").includes("Expo SecureStore"), "device container should name the future secure metadata adapter");
assert(readText("apps/mobile/src/device-container.ts").includes("LAN/hotspot direct transport"), "device container should name the future direct transport adapter");
assert(readText("tools/smoke-mobile-camera-scanner.mjs").includes("permissionDenied"), "mobile camera scanner smoke should verify denied permission behavior");
assert(readText("apps/mobile/scripts/capture-session.mjs").includes("createMobileCameraCaptureSession"), "mobile shell should create camera capture sessions");
assert(readText("apps/mobile/scripts/capture-session.mjs").includes("mobile-capture-sessions.jsonl"), "mobile camera capture sessions should persist a local log");
assert(readText("apps/mobile/scripts/capture-session.mjs").includes("prepareMobileEncryptedCapture"), "mobile camera capture sessions should encrypt original images");
assert(readText("tools/smoke-mobile-camera-capture-session.mjs").includes("Mobile camera capture session smoke test passed"), "mobile camera capture session smoke should verify encrypted capture and OCR commit");
assert(readText("apps/mobile/src/expo-storage.ts").includes("ExpoVaultStorageAdapter"), "mobile app should expose an Expo vault storage adapter");
assert(readText("apps/mobile/src/expo-storage.ts").includes("ExpoRuntimeStateStorageAdapter"), "mobile app should expose an Expo runtime-state storage adapter");
assert(readText("apps/mobile/src/expo-storage.ts").includes("ExpoSecureMetadataStore"), "mobile app should expose an Expo secure metadata store boundary");
assert(readText("apps/mobile/src/expo-storage.ts").includes("createExpoStoragePaths"), "mobile app should derive Expo document storage paths");
assert(readText("tools/smoke-mobile-expo-storage.mjs").includes("Expo-backed phone runtime"), "mobile Expo storage smoke should verify phone runtime persistence");
assert(readText("tools/smoke-mobile-expo-storage.mjs").includes("Expo-backed tablet runtime"), "mobile Expo storage smoke should verify tablet runtime persistence");
assert(readText("apps/desktop/src/vault-session.ts").includes("addRecordAsync"), "desktop vault session should support async field encryption");
assert(readText("apps/mobile/src/ocr-capture-workflow.ts").includes("commitMobileOcrCaptureAsync"), "mobile OCR workflow should support async field encryption");
assert(readText("apps/mobile/src/encrypted-capture.ts").includes("prepareMobileEncryptedCapture"), "mobile app should prepare encrypted capture attachments");
assert(readText("apps/mobile/src/file-vault-storage.ts").includes("MobileFileVaultStorageAdapter"), "mobile app should provide a local file vault storage adapter for preview/runtime persistence");
assert(readText("apps/mobile/src/runtime.ts").includes("vaultStorage"), "mobile runtime should accept a vault storage adapter");
assert(readText("apps/mobile/src/runtime.ts").includes("saveVaultState"), "mobile runtime should save vault state through its storage adapter");
assert(readText("apps/mobile/package.json").includes("scripts"), "mobile package should expose preview scripts");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createMobileShellAppState"), "mobile shell should build app-state from local modules");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("applyMobileShellReminderAction"), "mobile shell should expose reminder action handler");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createMobileReminderCenter"), "mobile shell should expose a reminder center view model");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("lastStatusAt") && readText("apps/mobile/scripts/app-state.mjs").includes("snoozedUntil"), "mobile reminder center should expose persisted action status details");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("commitMobileShellOcrDraft"), "mobile shell should expose OCR commit handler");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("startMobileShellCameraCapture"), "mobile shell should expose camera capture start handler");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("cameraCapture"), "mobile app-state should expose camera capture session status");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("deviceContainer"), "mobile app-state should expose the device container profile");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("transportPlan"), "mobile app-state should expose the shared transport plan");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("security: runtime.security.snapshot"), "mobile app-state should expose vault security snapshot");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createMobileShellNearFieldDiscovery"), "mobile shell should expose near-field discovery scan");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("resolveMobileShellDiscoveryCandidateAction"), "mobile shell should resolve near-field candidate actions");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createNearFieldEndpointProbeTargets"), "mobile shell should create probe targets from scan plans");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createNearFieldDiscoverySnapshot"), "mobile shell discovery should use sync-core discovery snapshots");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createNearFieldDiscoverySnapshotFromProbeTargets"), "mobile shell discovery should probe terminal endpoints");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createNearFieldConnectionState") && readText("apps/mobile/scripts/app-state.mjs").includes("connectionState"), "mobile shell should expose near-field connection state");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("scanMobileShellPairingPreview"), "mobile shell should expose pairing scan preview handler");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("trustMobileShellPairingPreview"), "mobile shell should expose pairing trust preview handler");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("confirmedCode"), "mobile shell QR pairing should require a six-digit confirmation code");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createMobileRuntime"), "mobile shell app-state should load the real mobile runtime");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("MobileFileVaultStorageAdapter"), "mobile shell app-state should use local vault snapshot storage");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("MobileFileRuntimeStateStorageAdapter"), "mobile shell app-state should use local runtime-state storage");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("resetMobileShellRuntimeForTests"), "mobile shell app-state should expose a runtime reset helper for persistence smoke tests");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("buildMobileVaultViewState"), "mobile shell app-state should use the mobile view-state model");
assert(!readText("apps/mobile/scripts/app-state.mjs").includes("LOGINTO_SHARED_TERMINAL_VAULT_PATH"), "mobile shell must not default to a shared terminal vault");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/status"), "mobile shell should expose local status API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/app-state"), "mobile shell should expose local app-state API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/reminders/action"), "mobile shell should expose reminder action API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/ocr/commit"), "mobile shell should expose OCR commit API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/capture/start"), "mobile shell should expose camera capture start API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/discovery/scan"), "mobile shell should expose near-field discovery scan API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/discovery/resolve"), "mobile shell should expose near-field candidate action API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/records"), "mobile shell should expose real record CRUD API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/pairing/scan"), "mobile shell should expose pairing scan API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/pairing/trust"), "mobile shell should expose pairing trust API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/sync/push"), "mobile shell should expose sync push API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/sync/preview"), "mobile shell should expose sync preview confirmation API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/sync/summary"), "mobile shell should expose sync summary API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/sync/receive"), "mobile shell should expose sync receive API");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("confirmationId: confirmation.id"), "mobile shell should bind outgoing sync packages to the preview confirmation");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("sessionId: confirmation.sessionId"), "mobile shell should bind outgoing sync packages to the preview session");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("assertSyncConfirmationStillCurrent"), "mobile shell should reject stale sync previews before push");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createSyncConfirmationReview"), "mobile shell should expose a structured sync review contract");
assert(readText("apps/mobile/prototype/index.html").includes("confirmation.review"), "mobile sync review UI should read the structured review contract");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("trustedDeviceSummaries"), "mobile app-state should expose trusted device summaries");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-trusted-devices"), "mobile prototype should show trusted device summaries");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("encryptedPackage"), "mobile shell should transmit encrypted sync packages");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("Encrypted sync exchange package is required"), "mobile receive should reject plaintext sync exchange packages");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("requireTrustedSyncPeer"), "mobile shell sync must require a trusted peer before preview, push, or receive");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("loginto-paired-device-sync-key-v1"), "mobile shell sync key should be bound to the paired device identities");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("record-snapshot-v1"), "mobile shell should carry encrypted record snapshots inside sync packages");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("record-delete-v1"), "mobile shell should carry encrypted delete tombstones inside sync packages");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("applyRecordSyncPayloadsToMobileVault"), "mobile shell should write applied sync record payloads into the local vault");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("findRecordConflictDecision"), "mobile shell should map preview conflict decisions before vault writeback");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("selectedRemoteOnlyFields"), "mobile shell manual merge should be able to add selected remote-only fields");
assert(readText("apps/mobile/scripts/app-state.mjs").includes('side: "remote-only"') && readText("apps/mobile/scripts/app-state.mjs").includes('key: "title"'), "mobile conflict preview should expose field side and title metadata differences");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("sentCount") && readText("apps/mobile/scripts/app-state.mjs").includes("receivedCount") && readText("apps/mobile/scripts/app-state.mjs").includes("conflictCount"), "mobile shell should persist complete sync receipt counts");
assert(readText("apps/mobile/scripts/app-state.mjs").includes('status: "success"'), "mobile shell should persist sync receipt status");
assert(readText("apps/mobile/scripts/app-state.mjs").includes('status: "failure"'), "mobile shell should persist failed sync receipt status");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("markSyncConfirmationFailed"), "mobile shell should consume failed sync confirmations");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("lastReceiptSummary"), "mobile shell should expose a stable sync receipt summary view model");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/sync/receive"), "desktop shell should expose sync receive API");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("createRequestBaseUrl(request)"), "desktop pairing start should advertise the current temporary HTTP endpoint");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("requireTrustedSyncPeer"), "desktop shell sync must require a trusted peer before preview, push, or receive");
assert(readText("apps/mobile/prototype/index.html").includes("LoginTo 手机保险库"), "mobile prototype should show the vault home screen");
assert(readText("apps/mobile/prototype/index.html").includes("/api/app-state"), "mobile prototype should load local app-state API");
assert(readText("apps/mobile/prototype/index.html").includes("/api/records"), "mobile prototype should call real record CRUD API");
assert(readText("apps/mobile/prototype/index.html").includes("data-storage-copy"), "mobile prototype should show local vault persistence status");
assert(readText("apps/mobile/prototype/index.html").includes("data-device-copy"), "mobile prototype should show local device identity status");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-security-panel"), "mobile prototype should show local vault security status");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-security-lock-state"), "mobile prototype should show vault lock state");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-security-second-unlock"), "mobile prototype should show second-unlock state");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-security-copy-clear"), "mobile prototype should show clipboard clear timing");
assert(readText("apps/mobile/prototype/index.html").includes("renderMobileSecurityPanel"), "mobile prototype should render vault security state from app-state");
assert(readText("apps/mobile/prototype/index.html").includes("/api/reminders/action"), "mobile prototype should call local reminder action API");
assert(readText("apps/mobile/prototype/index.html").includes("提醒中心"), "mobile prototype should show a reminder center");
assert(readText("apps/mobile/prototype/index.html").includes("data-reminder-tabs"), "mobile prototype should expose reminder filters");
assert(readText("apps/mobile/prototype/index.html").includes("data-reminder-list"), "mobile prototype should render reminder cards");
assert(readText("apps/mobile/prototype/index.html").includes("data-reminder-popup"), "mobile prototype should expose an actionable reminder popup");
assert(readText("apps/mobile/prototype/index.html").includes('data-reminder-popup-action="dismiss"'), "mobile reminder popup should support dismissing reminders");
assert(readText("apps/mobile/prototype/index.html").includes('data-reminder-action="complete"'), "mobile prototype should support completing a reminder from the center");
assert(readText("apps/mobile/prototype/index.html").includes('data-reminder-action="snooze"'), "mobile prototype should support snoozing a reminder from the center");
assert(readText("apps/mobile/prototype/index.html").includes('data-reminder-action="dismiss"'), "mobile prototype should support dismissing a reminder from the center");
assert(readText("apps/mobile/prototype/index.html").includes("data-reminder-status-detail"), "mobile prototype should show reminder action status details");
assert(readText("apps/mobile/prototype/index.html").includes("formatReminderStatusDetail"), "mobile prototype should format reminder completion and snooze details");
assert(readText("apps/mobile/prototype/index.html").includes("/api/ocr/commit"), "mobile prototype should call local OCR commit API");
assert(readText("apps/mobile/prototype/index.html").includes("/api/capture/start"), "mobile prototype should call local camera capture start API");
assert(readText("apps/mobile/prototype/index.html").includes("/api/discovery/scan"), "mobile prototype should call near-field discovery scan API");
assert(readText("apps/mobile/prototype/index.html").includes("ports: [4173]"), "mobile prototype should scan the desktop preview port");
assert(readText("apps/mobile/prototype/index.html").includes("data-discovery-probes"), "mobile prototype should show near-field probe diagnostics");
assert(readText("apps/mobile/prototype/index.html").includes("/api/pairing/scan"), "mobile prototype should call local pairing scan API");
assert(readText("apps/mobile/prototype/index.html").includes("/api/pairing/trust"), "mobile prototype should call local pairing trust API");
assert(readText("apps/mobile/prototype/index.html").includes("previewVerificationCode"), "mobile prototype should pass the scanned six-digit pairing code before trusting");
assert(readText("apps/mobile/prototype/index.html").includes("/api/sync/push"), "mobile prototype should call local sync push API");
assert(readText("apps/mobile/prototype/index.html").includes("/api/sync/preview"), "mobile prototype should call local sync preview API before push");
assert(readText("apps/mobile/prototype/index.html").includes("data-sync-preview"), "mobile prototype should show sync preview confirmation details");
assert(readText("apps/mobile/prototype/index.html").includes("data-near-field-candidates"), "mobile prototype should show near-field discovery candidates");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-transport-panel"), "mobile prototype should show near-field transport channel readiness");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-transport-action") && readText("apps/mobile/prototype/index.html").includes("蓝牙离线包信封"), "mobile prototype should expose bluetooth offline package readiness");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-flow"), "mobile prototype should show a near-field sync flow timeline");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-connection-state") && readText("apps/mobile/prototype/index.html").includes("renderMobileConnectionState"), "mobile prototype should show near-field connection state");
assert(readText("apps/mobile/prototype/index.html").includes("formatConnectionNextActionLabel") && readText("apps/mobile/prototype/index.html").includes("createMobileConnectionRetryRequest"), "mobile connection state should expose actionable next steps");
assert(readText("apps/mobile/prototype/index.html").includes("renderMobileSyncFlow(\"exchange\""), "mobile prototype should show encrypted package exchange progress");
assert(readText("apps/mobile/prototype/index.html").includes("data-candidate-reason"), "mobile prototype should explain why a near-field candidate needs pairing or re-pairing");
assert(readText("apps/mobile/prototype/index.html").includes("trustMobilePairing"), "mobile prototype should trust a candidate directly from near-field pairing actions");
assert(readText("apps/mobile/prototype/index.html").includes("data-sync-records"), "mobile prototype should show record-level sync preview details");
assert(readText("apps/mobile/prototype/index.html").includes("data-sync-review-panel"), "mobile prototype should show a first-class sync review panel");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-review-records"), "mobile prototype should show sync review record details");
assert(readText("apps/mobile/prototype/index.html").includes("openMobileSyncReviewPanel"), "mobile prototype should open a sync review panel before push");
assert(!readText("apps/mobile/prototype/index.html").includes("confirm(text)"), "mobile prototype must not use confirm-style sync review");
assert(readText("apps/mobile/prototype/index.html").includes("collectConflictDecisions"), "mobile prototype should collect sync conflict decisions before apply");
assert(readText("apps/mobile/prototype/index.html").includes("data-conflict-panel"), "mobile prototype should show a formal sync conflict decision panel");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-conflict-list"), "mobile prototype should show mobile conflict records before apply");
assert(readText("apps/mobile/prototype/index.html").includes("data-conflict-resolution"), "mobile prototype should emit structured conflict resolution choices");
assert(readText("apps/mobile/prototype/index.html").includes("manual-merge"), "mobile prototype should expose manual merge conflict choices");
assert(readText("apps/mobile/prototype/index.html").includes("data-manual-merge-fields"), "mobile prototype should collect field-level manual merge choices");
assert(readText("apps/mobile/prototype/index.html").includes("data-conflict-diff"), "mobile prototype should show local-vs-remote conflict differences");
assert(readText("apps/mobile/prototype/index.html").includes("data-conflict-option-help"), "mobile prototype should explain each conflict resolution impact");
assert(readText("apps/mobile/prototype/index.html").includes("data-conflict-decision-summary") && readText("apps/mobile/prototype/index.html").includes("updateConflictDecisionSummary"), "mobile prototype should show live conflict decision progress");
assert(readText("apps/mobile/prototype/index.html").includes("describeConflictField") && readText("apps/mobile/prototype/index.html").includes("filterConflictFieldsForSide"), "mobile prototype should show conflict field side metadata");
assert(!readText("apps/mobile/prototype/index.html").includes("prompt("), "mobile prototype must not use prompt-style sync conflict decisions");
assert(readText("apps/mobile/prototype/index.html").includes("data-sync-receipt"), "mobile prototype should show the latest sync receipt");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("const recentReceipts = createRecentSyncReceiptSummaries") && readText("apps/mobile/scripts/app-state.mjs").includes("recentReceipts,"), "mobile app-state should expose recent sync audit receipts");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-audit-log"), "mobile prototype should show a recent sync audit log");
assert(readText("apps/mobile/prototype/index.html").includes("renderMobileSyncAuditLog"), "mobile prototype should render recent sync audit receipts");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-recovery-action"), "mobile prototype should expose sync failure recovery actions");
assert(readText("apps/mobile/prototype/index.html").includes("recoveryActions") && readText("apps/mobile/prototype/index.html").includes("recoveryCopy"), "mobile prototype should render classified sync failure recovery guidance");
assert(readText("apps/mobile/prototype/index.html").includes("data-sync-center-item-detail") && readText("apps/mobile/prototype/index.html").includes("recoveryDetail"), "mobile prototype should show structured sync failure details");
assert(readText("apps/mobile/prototype/index.html").includes('data-mobile-sync-recovery-action="retry-sync"') && readText("apps/mobile/prototype/index.html").includes("mobileSyncRetryRequest"), "mobile prototype should retry sync from failure context");
assert(readText("apps/mobile/prototype/index.html").includes("重新配对桌面"), "mobile prototype should guide users through repair pairing after sync failure");
assert(readText("apps/mobile/prototype/index.html").includes("扫码配对"), "mobile prototype should show scan pairing UI");
assert(readText("apps/mobile/prototype/index.html").includes("拍照自动整理"), "mobile prototype should show camera OCR draft UI");
assert(readText("apps/mobile/prototype/index.html").includes("data-capture-form"), "mobile prototype should expose an editable OCR confirmation form");
assert(readText("apps/mobile/prototype/index.html").includes("data-camera-capture-status"), "mobile prototype should show camera capture session status");
assert(readText("apps/mobile/prototype/index.html").includes("data-ocr-fields"), "mobile prototype should render selectable OCR fields before commit");
assert(readText("apps/mobile/prototype/index.html").includes("acceptedFieldKeys"), "mobile prototype should submit selected OCR fields before vault write");
assert(readText("apps/mobile/prototype/index.html").includes("editedField:"), "mobile prototype should submit user-edited OCR field values before vault write");
assert(readText("apps/mobile/prototype/index.html").includes("data-capture-summary"), "mobile prototype should show OCR attachment and reminder summary before commit");
assert(readText("apps/mobile/prototype/index.html").includes("data-capture-attachment-note"), "mobile prototype should show encrypted attachment note before OCR commit");
assert(readText("apps/mobile/prototype/index.html").includes("data-capture-reminder-note"), "mobile prototype should preview reminder generation before OCR commit");
assert(readText("apps/mobile/prototype/index.html").includes("createReminder"), "mobile prototype should let users choose whether OCR creates a reminder");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("originalImageKeptAsEncryptedAttachment"), "mobile app-state should expose encrypted OCR attachment policy");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("normalizeOcrEditedFields"), "mobile app-state should normalize user-edited OCR field values");
assert(readText("apps/mobile/scripts/capture-session.mjs").includes("writeEncryptedCaptureBlobAtomically") && readText("apps/mobile/scripts/capture-session.mjs").includes("parseEncryptedAttachmentBlob") && readText("apps/mobile/scripts/capture-session.mjs").includes("writeVerified"), "mobile capture session should atomically persist and verify encrypted attachment blobs");
assert(readText("tools/smoke-mobile-camera-capture-session.mjs").includes("writeVerified") && readText("tools/smoke-mobile-camera-capture-session.mjs").includes(".tmp"), "mobile camera capture smoke should verify atomic attachment commit");
assert(readText("apps/mobile/prototype/index.html").includes("data-open-sheet=\"pair\""), "mobile prototype should expose pairing sheet interaction");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-pairing-image") && readText("apps/mobile/prototype/index.html").includes("BarcodeDetector"), "mobile prototype should accept QR image scans for pairing payloads when supported");
assert(readText("apps/mobile/prototype/index.html").includes("data-open-sheet=\"capture\""), "mobile prototype should expose capture sheet interaction");
assert(readText("apps/mobile/prototype/index.html").includes("data-activity-log"), "mobile prototype should show a visible local action log");
assert(readText("apps/tablet/package.json").includes("@loginto/tablet"), "tablet package should define a terminal app package");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createTabletShellAppState"), "tablet shell should build app-state from local modules");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createMobileRuntime"), "tablet shell should reuse the mobile/tablet runtime controller");
assert(readText("apps/tablet/scripts/app-state.mjs").includes('kind: "tablet"'), "tablet shell should identify as a tablet terminal");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createDeviceContainerProfile(\"tablet\")"), "tablet shell should expose the tablet device container profile");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("transportPlan"), "tablet shell should expose the shared transport plan");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("security: runtime.security.snapshot"), "tablet app-state should expose vault security snapshot");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("MobileFileVaultStorageAdapter"), "tablet shell should persist a local vault snapshot");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("MobileFileRuntimeStateStorageAdapter"), "tablet shell should persist local runtime-state");
assert(!readText("apps/tablet/scripts/app-state.mjs").includes("LOGINTO_SHARED_TERMINAL_VAULT_PATH"), "tablet shell must not default to a shared terminal vault");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("applyTabletShellReviewAction"), "tablet shell should expose a review confirmation action");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("updateTabletShellReviewNotes"), "tablet shell should expose encrypted review notes updates");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("applyTabletShellReminderAction"), "tablet shell should expose reminder action handler");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createTabletReminderCenter"), "tablet shell should expose a reminder center view model");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("lastStatusAt") && readText("apps/tablet/scripts/app-state.mjs").includes("snoozedUntil"), "tablet reminder center should expose persisted action status details");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createSyncReceiveFailureError") && readText("apps/tablet/scripts/app-state.mjs").includes("errorDetail"), "tablet shell should persist structured sync failure details");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("trustTabletShellDesktop"), "tablet shell should expose trusted-device action");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createTabletShellNearFieldDiscovery"), "tablet shell should expose near-field discovery scan");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("resolveTabletShellDiscoveryCandidateAction"), "tablet shell should resolve near-field candidate actions");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createNearFieldDiscoverySnapshotFromProbeTargets"), "tablet shell discovery should probe terminal endpoints");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createNearFieldConnectionState") && readText("apps/tablet/scripts/app-state.mjs").includes("connectionState"), "tablet shell should expose near-field connection state");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("scanTabletDesktopPairingPayload"), "tablet shell should trust desktops from QR pairing payloads");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("confirmedCode"), "tablet shell QR pairing should require a six-digit confirmation code");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/status"), "tablet shell should expose local status API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/app-state"), "tablet shell should expose local app-state API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/discovery/scan"), "tablet shell should expose near-field discovery scan API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/discovery/resolve"), "tablet shell should expose near-field candidate action API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/review/confirm"), "tablet shell should expose review confirmation API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/reminders/action"), "tablet shell should expose reminder action API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/review/notes"), "tablet shell should expose review notes API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/pairing/trust"), "tablet shell should expose pairing trust API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/sync/receive"), "tablet shell should expose sync receive API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/sync/summary"), "tablet shell should expose sync summary API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/sync/preview"), "tablet shell should expose sync preview API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/sync/push"), "tablet shell should expose sync push API");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("decryptShellSyncExchangePackage"), "tablet shell should receive encrypted sync packages");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createTabletShellSyncPreview"), "tablet shell should create sync preview confirmations");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("pushTabletShellSyncToDesktop"), "tablet shell should push encrypted sync packages to desktop");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("confirmationId: confirmation.id"), "tablet shell should bind outgoing sync packages to the preview confirmation");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("assertSyncConfirmationStillCurrent"), "tablet shell should reject stale sync previews before push");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createSyncConfirmationReview"), "tablet shell should expose a structured sync review contract");
assert(readText("apps/tablet/prototype/index.html").includes("confirmation.review"), "tablet sync review UI should read the structured review contract");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("trustedDeviceSummaries"), "tablet app-state should expose trusted device summaries");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-trusted-devices"), "tablet prototype should show trusted device summaries");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("requireTrustedSyncPeer"), "tablet shell sync receive must require a trusted sender");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("Encrypted sync exchange package is required"), "tablet receive should reject plaintext sync exchange packages");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("loginto-paired-device-sync-key-v1"), "tablet shell sync key should be bound to the paired device identities");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("record-snapshot-v1"), "tablet shell should carry encrypted record snapshots inside sync packages");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("applyRecordSyncPayloadsToTabletVault"), "tablet shell should write applied sync record payloads into the local vault");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("findRecordConflictDecision"), "tablet shell should map preview conflict decisions before vault writeback");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("selectedRemoteOnlyFields"), "tablet shell manual merge should be able to add selected remote-only fields");
assert(readText("apps/tablet/scripts/app-state.mjs").includes('side: "remote-only"') && readText("apps/tablet/scripts/app-state.mjs").includes('key: "title"'), "tablet conflict preview should expose field side and title metadata differences");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("sentCount") && readText("apps/tablet/scripts/app-state.mjs").includes("receivedCount") && readText("apps/tablet/scripts/app-state.mjs").includes("conflictCount"), "tablet shell should persist complete sync receipt counts");
assert(readText("apps/tablet/scripts/app-state.mjs").includes('status: "success"'), "tablet shell should persist sync receipt status");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("markSyncConfirmationFailed"), "tablet shell should consume failed sync confirmations");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("lastReceiptSummary"), "tablet shell should expose a stable sync receipt summary view model");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("writeJsonFileAtomically"), "tablet shell should atomically persist local sync state");
assert(readText("apps/tablet/prototype/index.html").includes("LoginTo 平板整理台"), "tablet prototype should show the tablet organizer surface");
assert(readText("apps/tablet/prototype/index.html").includes("/api/app-state"), "tablet prototype should load local app-state API");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-security-panel"), "tablet prototype should show local vault security status");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-security-lock-state"), "tablet prototype should show vault lock state");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-security-second-unlock"), "tablet prototype should show second-unlock state");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-security-copy-clear"), "tablet prototype should show clipboard clear timing");
assert(readText("apps/tablet/prototype/index.html").includes("renderTabletSecurityPanel"), "tablet prototype should render vault security state from app-state");
assert(readText("apps/tablet/prototype/index.html").includes("/api/review/confirm"), "tablet prototype should call review confirmation API");
assert(readText("apps/tablet/prototype/index.html").includes("/api/reminders/action"), "tablet prototype should call reminder action API");
assert(readText("apps/tablet/prototype/index.html").includes("提醒中心"), "tablet prototype should show a reminder center");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-reminder-tabs"), "tablet prototype should expose reminder filters");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-reminder-list"), "tablet prototype should render reminder cards");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-reminder-popup"), "tablet prototype should expose an actionable reminder popup");
assert(readText("apps/tablet/prototype/index.html").includes('data-tablet-reminder-popup-action="dismiss"'), "tablet reminder popup should support dismissing reminders");
assert(readText("apps/tablet/prototype/index.html").includes('data-reminder-action="complete"'), "tablet prototype should support completing a reminder from the center");
assert(readText("apps/tablet/prototype/index.html").includes('data-reminder-action="snooze"'), "tablet prototype should support snoozing a reminder from the center");
assert(readText("apps/tablet/prototype/index.html").includes('data-reminder-action="dismiss"'), "tablet prototype should support dismissing a reminder from the center");
assert(readText("apps/tablet/prototype/index.html").includes("data-reminder-status-detail"), "tablet prototype should show reminder action status details");
assert(readText("apps/tablet/prototype/index.html").includes("formatTabletReminderStatusDetail"), "tablet prototype should format reminder completion and snooze details");
assert(readText("apps/tablet/prototype/index.html").includes("/api/review/notes"), "tablet prototype should call review notes API");
assert(readText("apps/tablet/prototype/index.html").includes("/api/pairing/trust"), "tablet prototype should call pairing trust API");
assert(readText("apps/tablet/prototype/index.html").includes("/api/pairing/start"), "tablet prototype should request a desktop QR pairing payload before trusting");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-pairing-image") && readText("apps/tablet/prototype/index.html").includes("BarcodeDetector"), "tablet prototype should accept QR image scans for pairing payloads when supported");
assert(readText("apps/tablet/prototype/index.html").includes("/api/discovery/scan"), "tablet prototype should call near-field discovery scan API");
assert(readText("apps/tablet/prototype/index.html").includes("/api/discovery/resolve"), "tablet prototype should resolve near-field candidate actions");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-discovery-probes"), "tablet prototype should show near-field probe diagnostics");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-transport-panel"), "tablet prototype should show near-field transport channel readiness");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-transport-action") && readText("apps/tablet/prototype/index.html").includes("蓝牙离线包信封"), "tablet prototype should expose bluetooth offline package readiness");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-flow"), "tablet prototype should show a near-field sync flow timeline");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-connection-state") && readText("apps/tablet/prototype/index.html").includes("renderTabletConnectionState"), "tablet prototype should show near-field connection state");
assert(readText("apps/tablet/prototype/index.html").includes("formatConnectionNextActionLabel") && readText("apps/tablet/prototype/index.html").includes("createTabletConnectionRetryRequest"), "tablet connection state should expose actionable next steps");
assert(readText("apps/tablet/prototype/index.html").includes("renderTabletSyncFlow(\"exchange\""), "tablet prototype should show encrypted package exchange progress");
assert(readText("apps/tablet/prototype/index.html").includes("data-candidate-action"), "tablet prototype should expose candidate action buttons");
assert(readText("apps/tablet/prototype/index.html").includes("data-candidate-reason"), "tablet prototype should explain why a near-field candidate needs pairing or re-pairing");
assert(readText("apps/tablet/prototype/index.html").includes("/api/sync/preview"), "tablet prototype should call sync preview before push");
assert(readText("apps/tablet/prototype/index.html").includes("/api/sync/push"), "tablet prototype should call sync push after confirmation");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-review-panel"), "tablet prototype should show a sync review panel");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-review-summary"), "tablet prototype should show sync review summary counts");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-conflict-panel"), "tablet prototype should show a formal conflict decision panel");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-conflict-list"), "tablet prototype should list tablet sync conflicts");
assert(readText("apps/tablet/prototype/index.html").includes("data-conflict-resolution"), "tablet prototype should emit structured conflict resolution choices");
assert(readText("apps/tablet/prototype/index.html").includes("manual-merge"), "tablet prototype should expose manual merge conflict choices");
assert(readText("apps/tablet/prototype/index.html").includes("data-manual-merge-fields"), "tablet prototype should collect field-level manual merge choices");
assert(readText("apps/tablet/prototype/index.html").includes("data-conflict-diff"), "tablet prototype should show local-vs-remote conflict differences");
assert(readText("apps/tablet/prototype/index.html").includes("data-conflict-option-help"), "tablet prototype should explain each conflict resolution impact");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-conflict-decision-summary") && readText("apps/tablet/prototype/index.html").includes("updateTabletConflictDecisionSummary"), "tablet prototype should show live conflict decision progress");
assert(readText("apps/tablet/prototype/index.html").includes("describeTabletConflictField") && readText("apps/tablet/prototype/index.html").includes("filterTabletConflictFieldsForSide"), "tablet prototype should show conflict field side metadata");
assert(!readText("apps/tablet/prototype/index.html").includes("prompt("), "tablet prototype must not use prompt-style sync conflict decisions");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-receipt"), "tablet prototype should show the latest sync receipt");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("const recentReceipts = createRecentSyncReceiptSummaries") && readText("apps/tablet/scripts/app-state.mjs").includes("recentReceipts,"), "tablet app-state should expose recent sync audit receipts");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-audit-log"), "tablet prototype should show a recent sync audit log");
assert(readText("apps/tablet/prototype/index.html").includes("renderTabletSyncAuditLog"), "tablet prototype should render recent sync audit receipts");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-recovery-action"), "tablet prototype should expose sync failure recovery actions");
assert(readText("apps/tablet/prototype/index.html").includes("recoveryActions") && readText("apps/tablet/prototype/index.html").includes("recoveryCopy"), "tablet prototype should render classified sync failure recovery guidance");
assert(readText("apps/tablet/prototype/index.html").includes("data-sync-center-item-detail") && readText("apps/tablet/prototype/index.html").includes("recoveryDetail"), "tablet prototype should show structured sync failure details");
assert(readText("apps/tablet/prototype/index.html").includes('data-tablet-sync-recovery-action="retry-sync"') && readText("apps/tablet/prototype/index.html").includes("tabletSyncRetryRequest"), "tablet prototype should retry sync from failure context");
assert(readText("apps/tablet/prototype/index.html").includes("重新配对桌面"), "tablet prototype should guide users through repair pairing after sync failure");
assert(readText("tools/smoke-sync-tablet-to-desktop.mjs").includes("Sync confirmation is required"), "tablet-to-desktop smoke should verify preview confirmation is required before push");
assert(readText("tools/smoke-tablet-app-shell.mjs").includes("six-digit verification code"), "tablet app shell smoke should require QR pairing verification code");
assert(readText("tools/smoke-tablet-app-shell.mjs").includes("direct device identity trust"), "tablet app shell smoke should reject direct trusted-device identity pairing");
assert(readText("tools/smoke-tablet-app-shell.mjs").includes("dismissed status"), "tablet app shell smoke should verify dismissed reminder actions");
assert(readText("tools/smoke-mobile-app-shell.mjs").includes("six-digit verification code"), "mobile app shell smoke should require QR pairing verification code");
assert(readText("tools/smoke-mobile-app-shell.mjs").includes("public-network endpoints") && readText("tools/smoke-tablet-app-shell.mjs").includes("public-network endpoints"), "mobile and tablet app shell smokes should reject public-network pairing endpoints");
assert(readText("tools/smoke-sync-tablet-to-desktop.mjs").includes("plaintextExchangeIncluded"), "tablet-to-desktop smoke should verify encrypted package transport");
assert(readText("tools/smoke-near-field-transport.mjs").includes("responderMismatchRejected") && readText("tools/smoke-near-field-transport.mjs").includes("desktopNonJsonError"), "near-field transport smoke should verify responder identity and structured HTTP failures");
assert(readText("tools/smoke-sync-tablet-to-desktop.mjs").includes("confirmation replay"), "tablet-to-desktop smoke should reject reused sync confirmations");
assert(readText("tools/smoke-sync-failure-receipts.mjs").includes("tabletFailure") && readText("tools/smoke-sync-failure-receipts.mjs").includes("errorDetail"), "sync failure receipt smoke should verify structured failure details across all terminals");
assert(readText("tools/smoke-sync-failure-receipts.mjs").includes("retryRequest") && readText("tools/smoke-sync-failure-receipts.mjs").includes("retry-sync"), "sync failure receipt smoke should verify retry context across all terminals");
assert(readText("tools/smoke-sync-tablet-to-desktop.mjs").includes("stale confirmation"), "tablet-to-desktop smoke should reject stale sync previews");
assert(readText("tools/smoke-sync-tablet-to-desktop.mjs").includes('resolution: "manual-merge"'), "tablet-to-desktop smoke should verify manual merge conflict decisions");
assert(readText("tools/smoke-sync-tablet-to-desktop.mjs").includes('field.key === "notes"'), "tablet-to-desktop smoke should verify field-level conflict preview");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-activity"), "tablet prototype should show a visible review action log");
assert(readText("apps/tablet/prototype/index.html").includes("data-notes-form"), "tablet prototype should expose a review notes form");
assert(readText("tools/start-terminal-previews.mjs").includes("createDesktopShellServer"), "terminal preview launcher should start desktop shell");
assert(readText("tools/start-terminal-previews.mjs").includes("createMobileShellServer"), "terminal preview launcher should start mobile shell");
assert(readText("tools/start-terminal-previews.mjs").includes("createTabletShellServer"), "terminal preview launcher should start tablet shell");
assert(readText("tools/start-terminal-previews.mjs").includes("startTerminalPreviews"), "terminal preview launcher should expose a reusable start helper");
assert(readText("tools/start-terminal-previews.mjs").includes("EADDRINUSE"), "terminal preview launcher should tolerate occupied preview ports");
assert(readText("tools/start-terminal-previews.mjs").includes("reused"), "terminal preview launcher should reuse healthy existing previews");
assert(readText("tools/start-terminal-previews.mjs").includes("fallback"), "terminal preview launcher should fall back when occupied ports are not LoginTo previews");
assert(readText("tools/start-terminal-previews.mjs").includes("isExpectedExistingAppState"), "terminal preview launcher should avoid reusing stale app-state previews");
assert(readText("tools/start-desktop-native-shell.mjs").includes("startDesktopNativeShell"), "desktop native shell should expose a reusable launcher");
assert(readText("tools/start-desktop-native-shell.mjs").includes("--app="), "desktop native shell should open a dedicated app window");
assert(readText("tools/start-desktop-native-shell.mjs").includes("LoginTo desktop shell"), "desktop native shell should verify the desktop shell product");
assert(readText("tools/start-desktop-native-shell.mjs").includes("desktop-native-shell.out.log"), "desktop native shell should write readable launch logs");
assert(readText("LoginTo-Desktop.cmd").includes("tools\\start-desktop-native-shell.mjs"), "desktop command should run the native shell launcher");
assert(readText("tools/smoke-desktop-native-shell.mjs").includes("Desktop native shell smoke test passed"), "desktop native shell smoke should verify the window launcher without opening a browser");
assert(readText("tools/start-terminal-app-windows.mjs").includes("startTerminalAppWindows"), "terminal app windows should expose a reusable launcher");
assert(readText("tools/start-terminal-app-windows.mjs").includes("--app="), "terminal app windows should open dedicated app windows");
assert(readText("tools/start-terminal-app-windows.mjs").includes("parseTerminalArgs"), "terminal app windows should support opening one selected terminal");
assert(readText("tools/start-terminal-app-windows.mjs").includes("--terminal"), "terminal app windows should expose a single-terminal CLI option");
assert(readText("tools/start-terminal-app-windows.mjs").includes("LoginTo mobile shell"), "terminal app windows should verify the mobile shell product");
assert(readText("tools/start-terminal-app-windows.mjs").includes("LoginTo tablet shell"), "terminal app windows should verify the tablet shell product");
assert(readText("LoginTo.cmd").includes("LoginTo-App-Windows.cmd"), "main LoginTo launcher should open three terminal app windows");
assert(readText("LoginTo-SQLite.cmd").includes("LOGINTO_DESKTOP_STORAGE_KIND=sqlite") && readText("LoginTo-SQLite.cmd").includes("LoginTo-App-Windows.cmd"), "SQLite main launcher should open app windows with desktop SQLite storage");
assert(readText("LoginTo-App-Windows.cmd").includes("tools\\start-terminal-app-windows.mjs"), "app windows command should run the terminal app window launcher");
assert(readText("LoginTo-App-Desktop.cmd").includes("--terminal desktop"), "desktop app command should open only the desktop terminal app window");
assert(readText("LoginTo-App-Phone.cmd").includes("--terminal mobile"), "phone app command should open only the phone terminal app window");
assert(readText("LoginTo-App-Tablet.cmd").includes("--terminal tablet"), "tablet app command should open only the tablet terminal app window");
assert(readText("tools/smoke-terminal-app-windows.mjs").includes("Terminal app window smoke test passed"), "terminal app window smoke should verify app windows without opening visible browsers");
assert(readText("tools/smoke-terminal-app-windows.mjs").includes('terminals: ["mobile"]'), "terminal app window smoke should verify single-terminal app launching");
assert(readText("tools/package-usable-preview.mjs").includes("LoginTo-App-Desktop.cmd"), "usable preview package should include single-terminal app launchers");
assert(readText("tools/package-usable-preview.mjs").includes("可用预览交付包"), "usable preview package README should use readable Chinese copy");
assert(readText("tools/start-terminal-previews-detached.mjs").includes("detached: true"), "detached terminal preview launcher should start a long-lived child process");
assert(readText("tools/start-terminal-previews-detached.mjs").includes("terminal-previews-detached.out.log"), "detached terminal preview launcher should write a readable output log");
assert(readText("tools/accept-usable-preview.mjs").includes("LoginTo usable preview acceptance passed"), "usable preview acceptance should print a user-readable success message");
assert(readText("tools/accept-usable-preview.mjs").includes("startTerminalPreviews"), "usable preview acceptance should start terminal previews automatically");
assert(readText("tools/accept-usable-preview.mjs").includes("stopTerminalPreviews"), "usable preview acceptance should clean up terminal previews it started");
assert(readText("tools/accept-usable-preview.mjs").includes("tools/smoke-terminal-shells.mjs"), "usable preview acceptance should verify three-terminal sync");
assert(readText("tools/accept-usable-preview.mjs").includes("tools/smoke-discovery-candidate-actions.mjs"), "usable preview acceptance should verify near-field candidate actions");
assert(readText("tools/accept-usable-preview.mjs").includes("tools/smoke-near-field-connection-state.mjs"), "usable preview acceptance should verify near-field connection states");
assert(readText("tools/accept-usable-preview.mjs").includes("tools/smoke-sync-demo-failure-states.mjs"), "usable preview acceptance should verify timeout and peer rejection states");
assert(readText("tools/accept-usable-preview.mjs").includes("tools/smoke-sync-receipt-summary.mjs"), "usable preview acceptance should verify unified sync receipt summaries");
assert(readText("tools/accept-usable-preview.mjs").includes("tools/smoke-sync-review-contract.mjs"), "usable preview acceptance should verify sync review confirmation contracts");
assert(readText("tools/accept-usable-preview.mjs").includes("tools/smoke-package-usable-preview.mjs"), "usable preview acceptance should verify package launchers");
assert(readText("tools/accept-usable-preview.mjs").includes("tools/smoke-reset-preview-state.mjs"), "usable preview acceptance should verify reset safety");
assert(readText("tools/check-terminal-previews.mjs").includes("checkTerminalPreviews"), "terminal preview health check should expose a reusable checker");
assert(readText("tools/check-terminal-previews.mjs").includes("LoginTo preview health check passed"), "terminal preview health check should print a user-readable success message");
assert(readText("tools/check-terminal-previews.mjs").includes("missing-security-snapshot"), "terminal preview health check should verify the local security snapshot");
assert(readText("tools/check-terminal-previews.mjs").includes("missing-sync-audit-log"), "terminal preview health check should verify the sync audit log");
assert(readText("tools/create-readiness-report.mjs").includes("createReadinessReport"), "readiness report should expose a reusable report generator");
assert(readText("tools/create-readiness-report.mjs").includes("startTerminalPreviews"), "readiness report should start temporary previews automatically");
assert(readText("tools/create-readiness-report.mjs").includes("lastReceiptSummary"), "readiness report should include unified sync receipt summaries");
assert(readText("tools/create-readiness-report.mjs").includes("recentReceipts"), "readiness report should include recent sync audit logs");
assert(readText("tools/create-readiness-report.mjs").includes("formatConnectionState"), "readiness report should include near-field connection state");
assert(readText("tools/create-readiness-report.mjs").includes("近场候选"), "readiness report should include near-field candidate readiness");
assert(readText("tools/create-readiness-report.mjs").includes("失败记录提供重新扫描和重新配对入口"), "readiness report should describe sync failure recovery");
assert(readText("tools/create-readiness-report.mjs").includes("LoginTo-Data-Folder.cmd"), "readiness report should mention the local data folder launcher");
assert(readText("tools/create-readiness-report.mjs").includes("/api/app-state"), "readiness report should inspect live terminal app-state");
assert(readText("tools/create-readiness-report.mjs").includes("LoginTo 可用性报告"), "readiness report should generate a user-readable report");
assert(readText("tools/package-usable-preview.mjs").includes("packageUsablePreview"), "usable preview package should expose a reusable package helper");
assert(readText("tools/package-usable-preview.mjs").includes("LoginTo-Start.cmd"), "usable preview package should include the start launcher");
assert(readText("tools/package-usable-preview.mjs").includes("LoginTo-SQLite.cmd"), "usable preview package should include the SQLite app launcher");
assert(readText("tools/package-usable-preview.mjs").includes("LoginTo-Start-SQLite.cmd"), "usable preview package should include the SQLite start launcher");
assert(readText("tools/package-usable-preview.mjs").includes("LoginTo-Data-Folder.cmd"), "usable preview package should include the local data folder launcher");
assert(readText("tools/package-usable-preview.mjs").includes("desktopStorageModes"), "usable preview manifest should describe desktop storage modes");
assert(readText("tools/package-usable-preview.mjs").includes("LoginTo-Check.cmd"), "usable preview package should include the health check launcher");
assert(readText("tools/package-usable-preview.mjs").includes("renderLauncherWrapper"), "usable preview package should generate launchers that call back into the source workspace");
assert(readText("tools/package-usable-preview.mjs").includes("USABLE_PREVIEW.md"), "usable preview package should include the user guide");
assert(readText("tools/package-usable-preview.mjs").includes("manifest.json"), "usable preview package should generate a manifest");
assert(readText("tools/package-usable-preview.mjs").includes("loginto-readiness-report.md"), "usable preview package should include the readiness report");
assert(readText("LoginTo-Package.cmd").includes("tools\\package-usable-preview.mjs"), "package command should run the usable preview package helper");
assert(readText("LoginTo-Package.cmd").includes("dist\\LoginTo-usable-preview"), "package command should open the generated handoff folder");
assert(readText("tools/smoke-package-usable-preview.mjs").includes("Usable preview package smoke test passed"), "usable preview package smoke should verify the handoff folder");
assert(readText("tools/smoke-package-usable-preview.mjs").includes("LoginTo-Check.cmd"), "usable preview package smoke should verify the health check launcher");
assert(readText("tools/smoke-package-usable-preview.mjs").includes("LoginTo-Data-Folder.cmd"), "usable preview package smoke should verify the local data folder launcher");
assert(readText("tools/smoke-package-usable-preview.mjs").includes("LoginTo.cmd"), "usable preview package smoke should verify the main app launcher");
assert(readText("tools/smoke-package-usable-preview.mjs").includes("LoginTo-SQLite.cmd"), "usable preview package smoke should verify the SQLite app launcher");
assert(readText("tools/smoke-package-usable-preview.mjs").includes("LoginTo-Start-SQLite.cmd"), "usable preview package smoke should verify the SQLite launcher");
assert(readText("tools/smoke-package-usable-preview.mjs").includes("packaged start launcher should call back into the source workspace"), "package smoke should verify launcher wrappers call back into the source workspace");
assert(readText("tools/reset-preview-state.mjs").includes("resetPreviewState"), "preview reset should expose a reusable reset helper");
assert(readText("tools/reset-preview-state.mjs").includes("Refusing to reset preview state without --yes"), "preview reset should require explicit confirmation");
assert(readText("tools/reset-preview-state.mjs").includes(".tmp-archives"), "preview reset should archive old preview state instead of deleting it");
assert(readText("LoginTo-Start.cmd").includes("tools\\run-terminal-previews.cmd"), "start command should run the foreground terminal preview launcher");
assert(readText("LoginTo-Start-SQLite.cmd").includes("LOGINTO_DESKTOP_STORAGE_KIND=sqlite") && readText("LoginTo-Start-SQLite.cmd").includes("LOGINTO_DESKTOP_SQLITE_VAULT_PATH"), "SQLite start command should enable desktop SQLite storage");
assert(readText("LoginTo-App-Windows.cmd").includes("local services"), "app window command should describe local services instead of browser preview");
assert(readText("LoginTo-Check.cmd").includes("local services") && !readText("LoginTo-Check.cmd").includes("preview health"), "check command should describe local services");
assert(readText("tools/create-readiness-report.mjs").includes("storageKind") && readText("tools/create-readiness-report.mjs").includes("sqliteVaultPath"), "readiness report should show desktop storage kind and SQLite vault path");
assert(readText("LoginTo-Stop.cmd").includes("taskkill") && readText("LoginTo-Stop.cmd").includes("app-window-") && readText("LoginTo-Stop.cmd").includes("local services"), "stop command should stop local service listeners and app windows");
assert(readText("LoginTo-Data-Folder.cmd").includes("mkdir \".tmp\"") && readText("LoginTo-Data-Folder.cmd").includes("start \"\" \"%CD%\\.tmp\""), "data folder command should create and open the local .tmp data folder");
assert(readText("LoginTo-Check.cmd").includes("tools\\check-terminal-previews.mjs"), "check command should run the terminal preview health checker");
assert(readText("LoginTo-Report.cmd").includes("tools\\create-readiness-report.mjs"), "report command should generate the readiness report");
assert(readText("LoginTo-Report.cmd").includes(".tmp\\loginto-readiness-report.md"), "report command should open the generated readiness report");
assert(readText("LoginTo-Reset-Preview.cmd").includes("choice /C YN") && readText("LoginTo-Reset-Preview.cmd").includes("LoginTo.cmd") && readText("LoginTo-Reset-Preview.cmd").includes("app-window-"), "preview reset command should ask for confirmation and close app windows before changing local data");
assert(readText("LoginTo-Reset-Preview.cmd").includes("tools\\reset-preview-state.mjs --yes"), "preview reset command should call the confirmed preview reset helper");
assert(readText("LoginTo-Reset-Demo.cmd").includes("LoginTo-Reset-Preview.cmd"), "legacy reset command should forward to the preview reset entry");
assert(readText("LoginTo-Acceptance.cmd").includes("tools\\accept-usable-preview.mjs"), "acceptance command should run usable preview acceptance");
assert(readText("LoginTo-Acceptance.cmd").includes(".tmp\\loginto-usable-preview-acceptance.md"), "acceptance command should open the generated acceptance report");
assert(readText("tools/smoke-terminal-shells.mjs").includes("Terminal shell smoke test passed"), "terminal shell smoke should verify all terminal shells");
assert(readText("tools/smoke-terminal-discovery-shells.mjs").includes("Terminal discovery shell smoke test passed"), "terminal discovery shell smoke should verify desktop and mobile discovery surfaces");
assert(readText("tools/smoke-discovery-candidate-actions.mjs").includes("Discovery candidate action smoke passed"), "discovery candidate action smoke should verify pair, re-pair, and sync-preview decisions");
assert(readText("apps/desktop/prototype/index.html").includes("data-transport-panel"), "desktop prototype should show near-field transport channel readiness");
assert(readText("apps/desktop/prototype/index.html").includes("data-transport-action") && readText("apps/desktop/prototype/index.html").includes("蓝牙离线包信封"), "desktop prototype should expose bluetooth offline package readiness");
assert(readText("apps/desktop/prototype/index.html").includes("data-near-field-flow"), "desktop prototype should show a near-field sync flow timeline");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-connection-state") && readText("apps/desktop/prototype/index.html").includes("renderDesktopConnectionState"), "desktop prototype should show near-field connection state");
assert(readText("apps/desktop/prototype/index.html").includes("formatConnectionNextActionLabel") && readText("apps/desktop/prototype/index.html").includes("createDesktopConnectionRetryRequest"), "desktop connection state should expose actionable next steps");
assert(readText("apps/desktop/prototype/index.html").includes("renderNearFieldFlow(\"exchange\""), "desktop prototype should show encrypted package exchange progress");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("const recentReceipts = createRecentSyncReceiptSummaries") && readText("apps/desktop/scripts/app-state.mjs").includes("recentReceipts,"), "desktop app-state should expose recent sync audit receipts");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-sync-audit-log"), "desktop prototype should show a recent sync audit log");
assert(readText("apps/desktop/prototype/index.html").includes("renderDesktopSyncAuditLog"), "desktop prototype should render recent sync audit receipts");
assert(readText("apps/desktop/prototype/index.html").includes("data-sync-recovery-action"), "desktop prototype should expose sync failure recovery actions");
assert(readText("apps/desktop/prototype/index.html").includes("recoveryActions") && readText("apps/desktop/prototype/index.html").includes("recoveryCopy"), "desktop prototype should render classified sync failure recovery guidance");
assert(readText("apps/desktop/prototype/index.html").includes("data-sync-center-item-detail") && readText("apps/desktop/prototype/index.html").includes("recoveryDetail"), "desktop prototype should show structured sync failure details");
assert(readText("apps/desktop/prototype/index.html").includes('data-sync-recovery-action="retry-sync"') && readText("apps/desktop/prototype/index.html").includes("syncRetryRequest"), "desktop prototype should retry sync from failure context");
assert(readText("apps/desktop/prototype/index.html").includes("重新配对"), "desktop prototype should guide users through repair pairing after sync failure");
assert(readText("apps/desktop/prototype/index.html").includes("data-conflict-diff"), "desktop prototype should show local-vs-remote conflict differences");
assert(readText("apps/desktop/prototype/index.html").includes("data-conflict-option-help"), "desktop prototype should explain each conflict resolution impact");
assert(readText("tools/smoke-near-field-discovery-candidates.mjs").includes("Near-field discovery candidate smoke test passed"), "near-field discovery smoke should verify trust and re-pairing statuses");
assert(readText("tools/smoke-near-field-connection-state.mjs").includes("Near-field connection state smoke passed") && readText("tools/smoke-near-field-connection-state.mjs").includes("timed-out") && readText("tools/smoke-near-field-connection-state.mjs").includes("peer-rejected") && readText("tools/smoke-near-field-connection-state.mjs").includes("recovered"), "near-field connection state smoke should verify connection stages");
assert(readText("tools/smoke-sync-demo-failure-states.mjs").includes("simulateDesktopShellSyncFailure") && readText("tools/smoke-sync-demo-failure-states.mjs").includes("actOnDesktopShellSyncConfirmation") && readText("tools/smoke-sync-demo-failure-states.mjs").includes("timed-out") && readText("tools/smoke-sync-demo-failure-states.mjs").includes("peer-rejected"), "sync demo failure smoke should verify three-terminal demo failure and confirmation action state transitions");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("simulateDesktopShellSyncFailure") && readText("apps/mobile/scripts/app-state.mjs").includes("simulateMobileShellSyncFailure") && readText("apps/tablet/scripts/app-state.mjs").includes("simulateTabletShellSyncFailure"), "three app states should expose demo sync failure writers");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("actOnDesktopShellSyncConfirmation") && readText("apps/mobile/scripts/app-state.mjs").includes("actOnMobileShellSyncConfirmation") && readText("apps/tablet/scripts/app-state.mjs").includes("actOnTabletShellSyncConfirmation"), "three app states should expose pending sync confirmation actions");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/sync/demo-failure") && readText("apps/mobile/scripts/dev-server.mjs").includes("/api/sync/demo-failure") && readText("apps/tablet/scripts/dev-server.mjs").includes("/api/sync/demo-failure"), "three dev servers should expose sync failure smoke endpoints");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/sync/confirmation-action") && readText("apps/mobile/scripts/dev-server.mjs").includes("/api/sync/confirmation-action") && readText("apps/tablet/scripts/dev-server.mjs").includes("/api/sync/confirmation-action"), "three dev servers should expose sync confirmation action endpoints");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/sync/request") && readText("apps/mobile/scripts/dev-server.mjs").includes("/api/sync/request") && readText("apps/tablet/scripts/dev-server.mjs").includes("/api/sync/request"), "three dev servers should expose local sync request inbox endpoints");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/sync/request-result") && readText("apps/mobile/scripts/dev-server.mjs").includes("/api/sync/request-result") && readText("apps/tablet/scripts/dev-server.mjs").includes("/api/sync/request-result"), "three dev servers should expose local sync request result callback endpoints");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("receiveDesktopShellSyncRequest") && readText("apps/mobile/scripts/app-state.mjs").includes("receiveMobileShellSyncRequest") && readText("apps/tablet/scripts/app-state.mjs").includes("receiveTabletShellSyncRequest"), "three app states should receive local sync requests into pending confirmations");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("receiveDesktopShellSyncRequestResult") && readText("apps/mobile/scripts/app-state.mjs").includes("receiveMobileShellSyncRequestResult") && readText("apps/tablet/scripts/app-state.mjs").includes("receiveTabletShellSyncRequestResult"), "three app states should receive local sync request result callbacks");
assert(readText("tools/smoke-sync-review-contract.mjs").includes("assertIncomingRequest") && readText("tools/smoke-sync-review-contract.mjs").includes("resultDelivery") && readText("tools/smoke-sync-review-contract.mjs").includes("assertRejectedOrigin"), "sync review smoke should verify peer request delivery, incoming pending requests, and result callbacks");
assert(!readText("apps/desktop/prototype/index.html").includes("data-desktop-sync-demo-failure") && !readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-demo-failure") && !readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-demo-failure"), "three prototypes should not expose clickable sync demo failure controls");
assert(readText("apps/desktop/prototype/index.html").includes("data-sync-review-peer-reject") && readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-review-peer-reject") && readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-review-peer-reject"), "three prototypes should expose peer rejection controls in sync review");
assert(readText("apps/desktop/prototype/index.html").includes("data-sync-review-timeout") && readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-review-timeout") && readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-review-timeout"), "three prototypes should expose timeout controls in sync review");
assert(readText("tools/smoke-near-field-endpoint-probe.mjs").includes("Near-field endpoint probe smoke test passed"), "near-field endpoint probe smoke should verify status and summary probing");
assert(readText("tools/smoke-sync-receipt-summary.mjs").includes("Sync receipt summary smoke passed"), "sync receipt summary smoke should verify unified receipt display data");
assert(readText("tools/smoke-sync-receipt-summary.mjs").includes("assertFailureRecovery"), "sync receipt summary smoke should verify classified failure recovery guidance");
assert(readText("tools/smoke-sync-receipt-summary.mjs").includes("assertSyncCenter"), "sync receipt summary smoke should verify sync center summary data");
assert(readText("tools/smoke-trusted-device-management.mjs").includes("assertSyncCenterCounts"), "trusted device management smoke should verify sync center trusted/revoked counts");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("syncCenter: createSyncCenterSummary"), "desktop app-state should expose a local sync center");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("syncCenter: createSyncCenterSummary"), "mobile app-state should expose a local sync center");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("syncCenter: createSyncCenterSummary"), "tablet app-state should expose a local sync center");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-sync-center") && readText("apps/desktop/prototype/index.html").includes("renderDesktopSyncCenter"), "desktop prototype should render a local sync center");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-center") && readText("apps/mobile/prototype/index.html").includes("renderMobileSyncCenter"), "mobile prototype should render a local sync center");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-center") && readText("apps/tablet/prototype/index.html").includes("renderTabletSyncCenter"), "tablet prototype should render a local sync center");
assert(readText("apps/desktop/prototype/index.html").includes("data-desktop-sync-center-action"), "desktop sync center should expose actions");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-sync-center-action"), "mobile sync center should expose actions");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-sync-center-action"), "tablet sync center should expose actions");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("createSyncFailureRecovery"), "desktop app-state should classify sync failure recovery");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("createSyncFailureRecovery"), "mobile app-state should classify sync failure recovery");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("createSyncFailureRecovery"), "tablet app-state should classify sync failure recovery");
assert(readText("tools/smoke-sync-review-contract.mjs").includes("Sync review contract smoke passed"), "sync review contract smoke should verify peer, time, summary, and re-pairing requirements");
assert(readText("tools/smoke-trusted-device-management.mjs").includes("Trusted device management smoke passed"), "trusted device management smoke should verify visible trusted device summaries");
assert(readText("tools/smoke-trusted-device-management.mjs").includes("revokedDesktopTrustedDevices"), "trusted device management smoke should verify trusted-device revocation");
assert(readText("tools/smoke-trusted-device-management.mjs").includes("assertRejectedUnconfirmedRevocation"), "trusted device management smoke should verify revocation requires confirmation");
assert(readText("tools/smoke-trusted-device-management.mjs").includes("assertTrustedDeviceRevocations"), "trusted device management smoke should verify visible revocation audit events");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("revokeDesktopShellTrustedDevice"), "desktop app-state should expose trusted-device revocation");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("revokeMobileShellTrustedDevice"), "mobile app-state should expose trusted-device revocation");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("revokeTabletShellTrustedDevice"), "tablet app-state should expose trusted-device revocation");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("trustedDeviceRevocations"), "desktop app-state should expose trusted-device revocation audit events");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("trustedDeviceRevocations"), "mobile app-state should expose trusted-device revocation audit events");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("trustedDeviceRevocations"), "tablet app-state should expose trusted-device revocation audit events");
assert(readText("apps/desktop/scripts/app-state.mjs").includes("confirmDeviceName"), "desktop trusted-device revocation should require confirmed device name");
assert(readText("apps/mobile/scripts/app-state.mjs").includes("confirmDeviceName"), "mobile trusted-device revocation should require confirmed device name");
assert(readText("apps/tablet/scripts/app-state.mjs").includes("confirmDeviceName"), "tablet trusted-device revocation should require confirmed device name");
assert(readText("apps/desktop/scripts/dev-server.mjs").includes("/api/trusted-devices"), "desktop dev server should expose trusted-device revocation API");
assert(readText("apps/mobile/scripts/dev-server.mjs").includes("/api/trusted-devices"), "mobile dev server should expose trusted-device revocation API");
assert(readText("apps/tablet/scripts/dev-server.mjs").includes("/api/trusted-devices"), "tablet dev server should expose trusted-device revocation API");
assert(readText("apps/desktop/prototype/index.html").includes("data-trusted-device-action=\"revoke\""), "desktop prototype should expose trusted-device revoke action");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-trusted-device-action=\"revoke\""), "mobile prototype should expose trusted-device revoke action");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-trusted-device-action=\"revoke\""), "tablet prototype should expose trusted-device revoke action");
assert(readText("apps/desktop/prototype/index.html").includes("data-device-name") && readText("apps/desktop/prototype/index.html").includes("confirmDeviceName"), "desktop prototype should confirm the device name before revocation");
assert(readText("apps/mobile/prototype/index.html").includes("data-device-name") && readText("apps/mobile/prototype/index.html").includes("confirmDeviceName"), "mobile prototype should confirm the device name before revocation");
assert(readText("apps/tablet/prototype/index.html").includes("data-device-name") && readText("apps/tablet/prototype/index.html").includes("confirmDeviceName"), "tablet prototype should confirm the device name before revocation");
assert(readText("apps/desktop/prototype/index.html").includes("data-device-detail-action=\"toggle\""), "desktop prototype should expose trusted-device detail toggle");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-device-detail-action=\"toggle\""), "mobile prototype should expose trusted-device detail toggle");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-device-detail-action=\"toggle\""), "tablet prototype should expose trusted-device detail toggle");
assert(readText("apps/desktop/prototype/index.html").includes("data-device-detail") && readText("apps/desktop/prototype/index.html").includes("设备 ID"), "desktop prototype should render trusted-device identity details");
assert(readText("apps/mobile/prototype/index.html").includes("data-mobile-device-detail") && readText("apps/mobile/prototype/index.html").includes("设备 ID"), "mobile prototype should render trusted-device identity details");
assert(readText("apps/tablet/prototype/index.html").includes("data-tablet-device-detail") && readText("apps/tablet/prototype/index.html").includes("设备 ID"), "tablet prototype should render trusted-device identity details");
assert(readText("tools/smoke-trusted-device-management.mjs").includes("assertTrustedDeviceDetailUi"), "trusted device management smoke should verify detail and recovery UI");
assert(readText("tools/smoke-near-field-endpoint-probe.mjs").includes("plannedTargets"), "near-field endpoint probe smoke should verify scan plan target generation");
assert(readText("tools/smoke-bluetooth-sync-envelope.mjs").includes("Bluetooth sync envelope smoke test passed"), "bluetooth sync envelope smoke should verify encrypted offline package exchange");
assert(readText("tools/smoke-terminal-shells.mjs").includes("reusedTerminals"), "terminal shell smoke should verify occupied preview port reuse");
assert(readText("tools/smoke-terminal-shells.mjs").includes("localOnlyRecord"), "terminal shell smoke should verify local-only records do not leak through shared storage");
assert(readText("tools/smoke-terminal-shells.mjs").includes("confirmationRequired"), "terminal shell smoke should verify sync requires a preview confirmation");
assert(readText("tools/smoke-terminal-shells.mjs").includes("assertRecordLevelPreview"), "terminal shell smoke should verify record-level sync preview details");
assert(readText("tools/smoke-terminal-shells.mjs").includes("forbidden"), "terminal shell smoke should verify sync previews do not leak sensitive field values");
assert(!readText("tools/smoke-terminal-shells.mjs").includes("process.env.LOGINTO_SHARED_TERMINAL_VAULT_PATH ="), "terminal shell smoke must not set a shared terminal vault");
assert(readText("tools/smoke-terminal-previews-detached.mjs").includes("Terminal detached preview smoke test passed"), "detached terminal preview smoke should verify reachable preview URLs");
assert(readText("tools/smoke-terminal-previews-detached.mjs").includes("healthCheck"), "detached terminal preview smoke should verify the health check path");
assert(readText("tools/smoke-reset-preview-state.mjs").includes("Reset preview state smoke test passed"), "reset preview state smoke should verify archive-style reset behavior");
assert(readText("tools/smoke-sync-trust-gate.mjs").includes("desktopReceiveStatus"), "sync trust gate smoke should verify untrusted desktop receive is rejected");
assert(readText("tools/smoke-sync-trust-gate.mjs").includes("mobileReceiveStatus"), "sync trust gate smoke should verify untrusted mobile receive is rejected");
assert(readText("tools/smoke-sync-trust-gate.mjs").includes("tabletReceiveStatus"), "sync trust gate smoke should verify untrusted tablet receive is rejected");
assert(readText("tools/smoke-sync-trust-gate.mjs").includes("plaintextTabletReceiveStatus"), "sync trust gate smoke should verify terminal receive endpoints reject plaintext sync packages");
assert(readText("tools/smoke-terminal-shells.mjs").includes("assertRecentSyncReceipts"), "terminal shell smoke should verify visible sync audit receipts");
assertTextOrder(
  readText("apps/desktop/scripts/app-state.mjs"),
  "requireTrustedSyncPeer(runtime, senderDevice);",
  "await decryptShellSyncExchangePackage(input.encryptedPackage, runtime.localDevice, senderDevice)",
  "desktop receive must require a trusted sender before decrypting a sync package"
);
assertTextOrder(
  readText("apps/mobile/scripts/app-state.mjs"),
  "requireTrustedSyncPeer(runtime, senderDevice);",
  "await decryptShellSyncExchangePackage(input.encryptedPackage, runtime.localDevice, senderDevice)",
  "mobile receive must require a trusted sender before decrypting a sync package"
);
assertTextOrder(
  readText("apps/tablet/scripts/app-state.mjs"),
  "requireTrustedSyncPeer(runtime, senderDevice);",
  "await decryptShellSyncExchangePackage(input.encryptedPackage, runtime.localDevice, senderDevice)",
  "tablet receive must require a trusted sender before decrypting a sync package"
);

const ocrIndex = readText("packages/ocr-core/src/index.ts");
assert(ocrIndex.includes("writeDirectlyToVault: false"), "OCR drafts must not write directly to the vault");
assert(ocrIndex.includes("editedFields"), "OCR decisions should allow user-edited field values");
assert(ocrIndex.includes("createOcrDraftFromText"), "ocr-core should export OCR draft creation");
assert(readText("packages/ocr-core/src/heuristics.ts").includes("createRecordDraftFromOcrDecision"), "ocr-core should convert confirmed OCR drafts to record drafts");
assert(readText("packages/ocr-core/src/heuristics.ts").includes("normalizeEditedOcrValue"), "ocr-core should apply edited OCR field values before creating record drafts");

const docxPath = join(root, "docs/LoginTo_MVP与实施规划.docx");
if (existsSync(docxPath)) {
  assert(statSync(docxPath).size > 10_000, "Planning DOCX looks unexpectedly small");
}

for (const file of [
  ...collectFiles("packages", (file) => file.endsWith(".ts")),
  ...collectFiles("apps", (file) => file.endsWith(".ts"))
]) {
  try {
    execFileSync(process.execPath, ["--check", file], { cwd: root, stdio: "pipe" });
  } catch (error) {
    failures.push(`TypeScript syntax check failed: ${file}\n${error.stderr?.toString() ?? error.message}`);
  }
}

if (failures.length > 0) {
  console.error("Contract validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Contract validation passed.");
console.log(`Checked ${requiredFiles.length} required files, ${schemaFiles.length} schemas, ${expectedRecordTypes.length} record templates.`);
