import { rm } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const desktopRuntime = await import("../apps/desktop/src/runtime.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const root = process.cwd();
const vaultPath = join(root, ".tmp", "desktop-sqlite-runtime.vault-snapshot.json");
const sqliteVaultPath = join(root, ".tmp", "desktop-sqlite-runtime.sqlite");
const runtimeStatePath = join(root, ".tmp", "desktop-sqlite-runtime.runtime-state.json");
const now = () => "2026-07-01T16:30:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_desktop_sqlite_${this.value}`;
  }
};

for (const file of [vaultPath, sqliteVaultPath, runtimeStatePath]) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

const localDevice = sync.createDeviceIdentity({
  id: "device_desktop_sqlite_runtime",
  name: "Desktop SQLite Runtime",
  kind: "desktop",
  publicKeyBase64: "desktop-sqlite-runtime-key",
  now,
  ids
});

const runtime = await desktopRuntime.createDesktopRuntime({
  vaultPath,
  sqliteVaultPath,
  runtimeStatePath,
  storageKind: "sqlite",
  password: "desktop-sqlite-runtime-password",
  vaultName: "Desktop SQLite Runtime Vault",
  localDevice,
  kdfIterations: 20_000,
  now,
  ids
});

await runtime.addRecord({
  type: "membership",
  title: "SQLite Runtime Club",
  values: {
    member_name: "SQLite Runtime Club",
    member_id: "SQLITE-2026",
    expires_at: "2026-12-31T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-12-24T00:00:00.000Z",
      message: "SQLite Runtime Club expires soon",
      daysBefore: 7
    }
  ]
});

const reloaded = await desktopRuntime.createDesktopRuntime({
  vaultPath,
  sqliteVaultPath,
  runtimeStatePath,
  storageKind: "sqlite",
  password: "desktop-sqlite-runtime-password",
  vaultName: "Desktop SQLite Runtime Vault",
  localDevice,
  kdfIterations: 20_000,
  now,
  ids
});

const reloadedRecord = reloaded.session.getRecords().find((record) => record.title === "SQLite Runtime Club");
if (!reloadedRecord) {
  throw new Error("Expected desktop SQLite runtime to reload the saved record");
}

const db = new DatabaseSync(sqliteVaultPath);
const counts = {
  records: db.prepare("SELECT COUNT(*) AS count FROM records").get().count,
  fields: db.prepare("SELECT COUNT(*) AS count FROM record_fields").get().count,
  reminders: db.prepare("SELECT COUNT(*) AS count FROM reminders").get().count,
  snapshotRows: db.prepare("SELECT COUNT(*) AS count FROM vault_metadata WHERE key = 'snapshot_json'").get().count
};
db.close();

if (counts.records < 1 || counts.fields < 1 || counts.reminders < 1 || counts.snapshotRows !== 1) {
  throw new Error(`Expected SQLite runtime to persist normalized rows: ${JSON.stringify(counts)}`);
}

runtime.storage.close?.();
reloaded.storage.close?.();

console.log("Desktop SQLite runtime smoke test passed.");
console.log(JSON.stringify({
  sqliteVaultPath,
  reloadedRecords: reloaded.session.getRecords().length,
  normalizedRows: counts,
  storageKind: "sqlite"
}, null, 2));
