import { rm } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const desktopShell = await import("../apps/desktop/scripts/app-state.mjs");

const root = process.cwd();
const sourceVaultPath = join(root, ".tmp", "desktop-sqlite-backup-source.vault-snapshot.json");
const sourceSqlitePath = join(root, ".tmp", "desktop-sqlite-backup-source.sqlite");
const sourceRuntimeStatePath = join(root, ".tmp", "desktop-sqlite-backup-source.runtime-state.json");
const deviceIdentityPath = join(root, ".tmp", "desktop-sqlite-backup.device-identity.json");
const backupPackagePath = join(root, ".tmp", "desktop-sqlite-backup.package.json");
const verifyVaultPath = join(root, ".tmp", "desktop-sqlite-backup-verify.vault-snapshot.json");
const verifySqlitePath = join(root, ".tmp", "desktop-sqlite-backup-verify.sqlite");
const verifyRuntimeStatePath = join(root, ".tmp", "desktop-sqlite-backup-verify.runtime-state.json");

for (const file of [
  sourceVaultPath,
  sourceSqlitePath,
  sourceRuntimeStatePath,
  deviceIdentityPath,
  backupPackagePath,
  verifyVaultPath,
  verifySqlitePath,
  verifyRuntimeStatePath
]) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

const shellInput = {
  vaultPath: sourceVaultPath,
  sqliteVaultPath: sourceSqlitePath,
  runtimeStatePath: sourceRuntimeStatePath,
  deviceIdentityPath,
  storageKind: "sqlite",
  backupPackagePath
};

await desktopShell.createDesktopShellRecord({
  ...shellInput,
  title: "SQLite Backup Membership",
  type: "membership",
  values: {
    member_name: "SQLite Backup Membership",
    member_id: "SQLITE-BACKUP-2026",
    expires_at: "2027-09-01T00:00:00.000Z",
    service_phone: "400-555-0199"
  },
  reminderDrafts: [
    {
      dueAt: "2027-08-25T09:00:00.000Z",
      message: "SQLite Backup Membership expires soon",
      daysBefore: 7
    }
  ]
});

const exported = await desktopShell.exportDesktopShellBackupPackage(shellInput);
if (exported.summary.records < 5) {
  throw new Error(`Expected SQLite source backup to include seeded plus created records: ${exported.summary.records}`);
}

const verified = await desktopShell.verifyDesktopShellBackupPackage({
  ...shellInput,
  verifyVaultPath,
  verifySqliteVaultPath: verifySqlitePath,
  verifyRuntimeStatePath,
  verifyStorageKind: "sqlite"
});

if (verified.summary.storageKind !== "sqlite") {
  throw new Error(`Expected backup verification to restore into SQLite storage: ${verified.summary.storageKind}`);
}
if (verified.summary.records !== exported.summary.records) {
  throw new Error(`Expected restored SQLite backup records to match export: ${verified.summary.records} !== ${exported.summary.records}`);
}

const db = new DatabaseSync(verifySqlitePath);
const counts = {
  records: db.prepare("SELECT COUNT(*) AS count FROM records").get().count,
  fields: db.prepare("SELECT COUNT(*) AS count FROM record_fields").get().count,
  reminders: db.prepare("SELECT COUNT(*) AS count FROM reminders").get().count,
  snapshotRows: db.prepare("SELECT COUNT(*) AS count FROM vault_metadata WHERE key = 'snapshot_json'").get().count
};
db.close();

if (counts.records !== verified.summary.records || counts.snapshotRows !== 1) {
  throw new Error(`Expected restored SQLite backup to persist normalized rows: ${JSON.stringify(counts)}`);
}

console.log("Desktop SQLite backup restore smoke test passed.");
console.log(JSON.stringify({
  packageFormat: exported.summary.format,
  exportedRecords: exported.summary.records,
  restoredRecords: verified.summary.records,
  dueReminders: verified.summary.dueReminders,
  normalizedRows: counts,
  storageKind: verified.summary.storageKind
}, null, 2));
