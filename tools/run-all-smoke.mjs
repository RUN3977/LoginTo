import { spawnSync } from "node:child_process";

const scripts = [
  "tools/validate-contracts.mjs",
  "tools/smoke-async-app-workflows.mjs",
  "tools/smoke-async-field-encryption.mjs",
  "tools/smoke-attachment-encryption.mjs",
  "tools/smoke-native-crypto-adapter.mjs",
  "tools/smoke-webcrypto-adapter.mjs",
  "tools/smoke-vault-core.mjs",
  "tools/smoke-app-near-field-endpoints.mjs",
  "tools/smoke-app-pairing-workflow.mjs",
  "tools/smoke-app-runtimes.mjs",
  "tools/smoke-desktop-app-shell.mjs",
  "tools/smoke-desktop-backup-restore.mjs",
  "tools/smoke-desktop-local-network-transport.mjs",
  "tools/smoke-desktop-network-candidates.mjs",
  "tools/smoke-desktop-reminder-notification-state.mjs",
  "tools/smoke-device-identity-unique-keys.mjs",
  "tools/smoke-desktop-storage.mjs",
  "tools/smoke-desktop-session.mjs",
  "tools/smoke-desktop-view-state.mjs",
  "tools/smoke-mobile-expo-storage.mjs",
  "tools/smoke-mobile-app-shell.mjs",
  "tools/smoke-mobile-camera-scanner.mjs",
  "tools/smoke-mobile-encrypted-capture.mjs",
  "tools/smoke-mobile-local-network-transport.mjs",
  "tools/smoke-mobile-pairing-client.mjs",
  "tools/smoke-mobile-runtime-state.mjs",
  "tools/smoke-mobile-ocr-workflow.mjs",
  "tools/smoke-mobile-view-state.mjs",
  "tools/smoke-tablet-app-shell.mjs",
  "tools/smoke-terminal-shells.mjs",
  "tools/smoke-terminal-previews-detached.mjs",
  "tools/smoke-ocr-draft.mjs",
  "tools/smoke-pairing-matrix.mjs",
  "tools/smoke-pairing-workflow.mjs",
  "tools/smoke-reminders.mjs",
  "tools/smoke-reminder-notifications.mjs",
  "tools/smoke-terminal-notification-bridge.mjs",
  "tools/smoke-runtime-reminder-notifications.mjs",
  "tools/smoke-runtime-terminal-notifications.mjs",
  "tools/smoke-runtime-native-crypto.mjs",
  "tools/smoke-runtime-security.mjs",
  "tools/smoke-near-field-endpoint.mjs",
  "tools/smoke-near-field-handler.mjs",
  "tools/smoke-near-field-transport.mjs",
  "tools/smoke-sqlite-adapter.mjs",
  "tools/smoke-sync-apply.mjs",
  "tools/smoke-sync-core.mjs",
  "tools/smoke-sync-conflicts.mjs",
  "tools/smoke-sync-delete-propagation.mjs",
  "tools/smoke-sync-exchange.mjs",
  "tools/smoke-sync-failure-receipts.mjs",
  "tools/smoke-sync-review-contract.mjs",
  "tools/smoke-trusted-device-management.mjs",
  "tools/smoke-sync-manual-merge-vault.mjs",
  "tools/smoke-sync-paired-device-key.mjs",
  "tools/smoke-sync-tablet-to-desktop.mjs",
  "tools/smoke-sync-trust-gate.mjs",
  "tools/smoke-sync-state.mjs",
  "tools/smoke-sync-session.mjs",
  "tools/smoke-vault-security.mjs"
];

for (const script of scripts) {
  console.log(`\n> node ${script}`);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll smoke checks passed.");
