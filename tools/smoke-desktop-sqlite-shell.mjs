import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const desktopShell = await import("../apps/desktop/scripts/app-state.mjs");

const root = process.cwd();
const vaultPath = join(root, ".tmp", "desktop-sqlite-shell.vault-snapshot.json");
const sqliteVaultPath = join(root, ".tmp", "desktop-sqlite-shell.sqlite");
const runtimeStatePath = join(root, ".tmp", "desktop-sqlite-shell.runtime-state.json");
const deviceIdentityPath = join(root, ".tmp", "desktop-sqlite-shell.device-identity.json");
const syncDeletionsPath = join(root, ".tmp", "desktop-sqlite-shell.sync-deletions.json");
const syncReceiptsPath = join(root, ".tmp", "desktop-sqlite-shell.sync-receipts.json");
const syncConfirmationsPath = join(root, ".tmp", "desktop-sqlite-shell.sync-confirmations.json");

for (const file of [
  vaultPath,
  sqliteVaultPath,
  runtimeStatePath,
  deviceIdentityPath,
  syncDeletionsPath,
  syncReceiptsPath,
  syncConfirmationsPath
]) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

const shellInput = {
  vaultPath,
  sqliteVaultPath,
  runtimeStatePath,
  deviceIdentityPath,
  syncDeletionPath: syncDeletionsPath,
  syncReceiptPath: syncReceiptsPath,
  syncConfirmationPath: syncConfirmationsPath,
  storageKind: "sqlite"
};

const initial = await desktopShell.createDesktopShellAppState(shellInput);
if (initial.vault.storageKind !== "sqlite") {
  throw new Error(`Expected desktop shell to expose sqlite storage kind: ${initial.vault.storageKind}`);
}

const createdState = await desktopShell.createDesktopShellRecord({
  ...shellInput,
  title: "SQLite Shell Member",
  type: "membership",
  values: {
    member_name: "SQLite Shell Member",
    member_id: "SQLITE-SHELL-2026",
    expires_at: "2028-12-01T00:00:00.000Z",
    service_phone: "400-000-0000",
    notes: "Created in desktop SQLite shell smoke."
  }
});
const createdRecord = createdState.records.find((record) => record.title === "SQLite Shell Member");
if (!createdRecord?.recordId) {
  throw new Error("Expected desktop SQLite shell to create a UI record");
}

const deletedState = await desktopShell.deleteDesktopShellRecord({
  ...shellInput,
  recordId: createdRecord.recordId,
  deletedAt: "2026-07-01T16:45:00.000Z"
});
if (deletedState.records.some((record) => record.recordId === createdRecord.recordId)) {
  throw new Error("Expected desktop SQLite shell delete to remove the record from app-state");
}

const syncSummary = await desktopShell.getDesktopShellSyncSummary(shellInput);
const deletedSummary = syncSummary.records.find((record) => record.id === createdRecord.recordId && record.deleted);
if (!deletedSummary) {
  throw new Error("Expected desktop SQLite sync summary to include the deletion tombstone");
}

const deletions = JSON.parse(await readFile(syncDeletionsPath, "utf8")).deletedRecords;
if (!deletions.some((record) => record.id === createdRecord.recordId && record.vaultId)) {
  throw new Error("Expected desktop SQLite delete to persist a vault-scoped tombstone");
}

const db = new DatabaseSync(sqliteVaultPath);
const counts = {
  records: db.prepare("SELECT COUNT(*) AS count FROM records").get().count,
  fields: db.prepare("SELECT COUNT(*) AS count FROM record_fields").get().count,
  reminders: db.prepare("SELECT COUNT(*) AS count FROM reminders").get().count,
  snapshotRows: db.prepare("SELECT COUNT(*) AS count FROM vault_metadata WHERE key = 'snapshot_json'").get().count
};
db.close();

if (counts.snapshotRows !== 1) {
  throw new Error(`Expected desktop SQLite shell to keep a snapshot row: ${JSON.stringify(counts)}`);
}
if (counts.records !== deletedState.records.length) {
  throw new Error(`Expected normalized SQLite record rows to match visible shell records: ${JSON.stringify(counts)}`);
}

console.log("Desktop SQLite shell smoke test passed.");
console.log(JSON.stringify({
  storageKind: initial.vault.storageKind,
  sqliteVaultPath,
  deletedRecordId: createdRecord.recordId,
  tombstones: deletions.length,
  syncSummaryDeleted: Boolean(deletedSummary),
  normalizedRows: counts
}, null, 2));
