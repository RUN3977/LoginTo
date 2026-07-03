const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");

const fixedNow = () => "2026-06-05T16:45:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

class FakeSqliteExecutor {
  metadata = new Map();
  statements = [];

  async execute(sql, params = []) {
    this.statements.push({ sql, params });
    const normalized = sql.trim().toLowerCase();
    if (normalized.startsWith("insert or replace into vault_metadata")) {
      this.metadata.set(String(params[0]), String(params[1]));
    }
    if (normalized.startsWith("delete from vault_metadata")) {
      this.metadata.delete(String(params[0]));
    }
  }

  async query(sql, params = []) {
    this.statements.push({ sql, params });
    const normalized = sql.trim().toLowerCase();
    if (normalized.startsWith("select value from vault_metadata")) {
      const value = this.metadata.get(String(params[0]));
      return { rows: value === undefined ? [] : [{ value }] };
    }
    return { rows: [] };
  }

  async transaction(work) {
    return work(this);
  }
}

const manifest = vault.createVaultManifest({
  name: "SQLite Smoke Vault",
  deviceId: "device_sqlite_smoke",
  now: fixedNow,
  ids
});

const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);
const draft = vault.createRecordDraft({
  type: "bank_card",
  title: "Travel Card",
  values: {
    bank_name: "Example Bank",
    card_number: "4111111111111111",
    expiry_date: "2028-12-01T00:00:00.000Z"
  }
});

const record = repository.insertRecord(
  vault.createVaultRecord({
    draft,
    encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
    now: fixedNow,
    ids
  })
);
repository.addAttachment(record.id, vault.createAttachmentRef({
  recordId: record.id,
  encryptedBlobPath: ".tmp/sqlite-smoke-card.jpg.enc",
  mimeType: "image/jpeg",
  digest: "sqlite-smoke-digest",
  encryptedSize: 128,
  source: "camera",
  now: fixedNow,
  ids
}));
repository.addReminder(record.id, vault.createReminderRule({
  recordId: record.id,
  dueAt: "2028-11-01T00:00:00.000Z",
  message: "Travel Card expires soon",
  daysBefore: 30,
  now: fixedNow,
  ids
}));

const executor = new FakeSqliteExecutor();
const adapter = new vault.SqliteVaultStorageAdapter(executor);

await adapter.save(repository.snapshot());

if (!(await adapter.exists())) {
  throw new Error("Expected SQLite adapter snapshot to exist");
}

const loadedSnapshot = await adapter.load();
if (!loadedSnapshot) {
  throw new Error("Expected SQLite adapter to load snapshot");
}

if (loadedSnapshot.records.length !== 1) {
  throw new Error(`Expected 1 loaded record, got ${loadedSnapshot.records.length}`);
}
assertStatementIncludes(executor.statements, "insert or replace into records", "record row insert");
assertStatementIncludes(executor.statements, "insert or replace into record_fields", "record field row insert");
assertStatementIncludes(executor.statements, "insert or replace into attachments", "attachment row insert");
assertStatementIncludes(executor.statements, "insert or replace into reminders", "reminder row insert");

await adapter.delete();
if (await adapter.exists()) {
  throw new Error("Expected SQLite adapter snapshot to be deleted");
}
assertStatementIncludes(executor.statements, "delete from records", "record row delete");

console.log("SQLite adapter smoke test passed.");
console.log(
  JSON.stringify(
    {
      records: loadedSnapshot.records.length,
      fields: loadedSnapshot.records[0].fields.length,
      attachments: loadedSnapshot.records[0].attachments.length,
      reminders: loadedSnapshot.records[0].reminders.length,
      statements: executor.statements.length,
      deletedAfterSmoke: !(await adapter.exists())
    },
    null,
    2
  )
);

function assertStatementIncludes(statements, pattern, label) {
  const found = statements.some((statement) => statement.sql.trim().toLowerCase().includes(pattern));
  if (!found) {
    throw new Error(`Expected SQLite adapter to execute ${label}`);
  }
}
