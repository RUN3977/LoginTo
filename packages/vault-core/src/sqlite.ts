import {
  parseVaultSnapshot,
  serializeVaultSnapshot,
  type VaultSnapshot,
  type VaultStorageAdapter
} from "./storage.ts";

export const SQLITE_SCHEMA_VERSION = 1;

export type SqliteValue = string | number | Uint8Array | null;

export interface SqliteQueryResult<Row> {
  rows: Row[];
}

export interface SqliteExecutor {
  execute(sql: string, params?: readonly SqliteValue[]): Promise<void>;
  query<Row extends Record<string, SqliteValue>>(sql: string, params?: readonly SqliteValue[]): Promise<SqliteQueryResult<Row>>;
  transaction<T>(work: (executor: SqliteExecutor) => Promise<T>): Promise<T>;
}

export interface SqliteVaultStorageOptions {
  vaultId: string;
  schemaVersion?: typeof SQLITE_SCHEMA_VERSION;
}

export const SQLITE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS vault_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    category_id TEXT,
    tag_ids_json TEXT NOT NULL,
    favorite INTEGER NOT NULL,
    archived INTEGER NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS record_fields (
    record_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value_cipher TEXT NOT NULL,
    sensitivity TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (record_id, key),
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY NOT NULL,
    record_id TEXT NOT NULL,
    encrypted_blob_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    digest TEXT NOT NULL,
    encrypted_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    source TEXT NOT NULL,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY NOT NULL,
    record_id TEXT NOT NULL,
    due_at TEXT NOT NULL,
    message TEXT NOT NULL,
    days_before INTEGER NOT NULL,
    repeat TEXT NOT NULL,
    status TEXT NOT NULL,
    snoozed_until TEXT,
    completed_at TEXT,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_records_updated_at ON records(updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_record_fields_record_id ON record_fields(record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attachments_record_id ON attachments(record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_record_id ON reminders(record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_due_at ON reminders(due_at)`
] as const;

export async function initializeSqliteVaultSchema(executor: SqliteExecutor): Promise<void> {
  await executor.transaction(async (tx) => {
    await executeSqliteSchemaStatements(tx);
    await tx.execute("INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?, ?)", [
      "sqlite_schema_version",
      String(SQLITE_SCHEMA_VERSION)
    ]);
  });
}

export class SqliteVaultStorageAdapter implements VaultStorageAdapter {
  readonly executor: SqliteExecutor;

  constructor(executor: SqliteExecutor) {
    this.executor = executor;
  }

  async exists(): Promise<boolean> {
    const result = await this.executor.query<{ value: string }>(
      "SELECT value FROM vault_metadata WHERE key = ?",
      ["snapshot_json"]
    );
    return result.rows.length > 0;
  }

  async load(): Promise<VaultSnapshot | undefined> {
    const result = await this.executor.query<{ value: string }>(
      "SELECT value FROM vault_metadata WHERE key = ?",
      ["snapshot_json"]
    );
    const value = result.rows[0]?.value;
    return typeof value === "string" ? parseVaultSnapshot(value) : undefined;
  }

  async save(snapshot: VaultSnapshot): Promise<void> {
    const serialized = serializeVaultSnapshot(snapshot);
    await this.executor.transaction(async (tx) => {
      await executeSqliteSchemaStatements(tx);
      await tx.execute("INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?, ?)", [
        "sqlite_schema_version",
        String(SQLITE_SCHEMA_VERSION)
      ]);
      await tx.execute("INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?, ?)", [
        "snapshot_json",
        serialized
      ]);
      await persistVaultSnapshotRows(tx, snapshot);
    });
  }

  async delete(): Promise<void> {
    await this.executor.transaction(async (tx) => {
      await tx.execute("DELETE FROM reminders");
      await tx.execute("DELETE FROM attachments");
      await tx.execute("DELETE FROM record_fields");
      await tx.execute("DELETE FROM records");
      await tx.execute("DELETE FROM vault_metadata WHERE key = ?", ["snapshot_json"]);
    });
  }
}

export function assertSqliteSchemaStatements(statements: readonly string[] = SQLITE_SCHEMA_STATEMENTS): void {
  const joined = statements.join("\n").toLowerCase();
  const requiredTables = ["vault_metadata", "records", "record_fields", "attachments", "reminders"];
  for (const table of requiredTables) {
    if (!joined.includes(`create table if not exists ${table}`)) {
      throw new Error(`SQLite schema is missing table: ${table}`);
    }
  }
}

async function executeSqliteSchemaStatements(executor: SqliteExecutor): Promise<void> {
  for (const statement of SQLITE_SCHEMA_STATEMENTS) {
    await executor.execute(statement);
  }
}

async function persistVaultSnapshotRows(executor: SqliteExecutor, snapshot: VaultSnapshot): Promise<void> {
  await executor.execute("DELETE FROM reminders");
  await executor.execute("DELETE FROM attachments");
  await executor.execute("DELETE FROM record_fields");
  await executor.execute("DELETE FROM records");

  for (const record of snapshot.records) {
    await executor.execute(
      `INSERT OR REPLACE INTO records (
        id,
        type,
        title,
        category_id,
        tag_ids_json,
        favorite,
        archived,
        version,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.type,
        record.title,
        record.categoryId ?? null,
        JSON.stringify(record.tagIds),
        record.favorite ? 1 : 0,
        record.archived ? 1 : 0,
        record.version,
        record.createdAt,
        record.updatedAt
      ]
    );

    for (const field of record.fields) {
      await executor.execute(
        `INSERT OR REPLACE INTO record_fields (
          record_id,
          key,
          value_cipher,
          sensitivity,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          record.id,
          field.key,
          field.valueCipher,
          field.sensitivity,
          field.updatedAt
        ]
      );
    }

    for (const attachment of record.attachments) {
      await executor.execute(
        `INSERT OR REPLACE INTO attachments (
          id,
          record_id,
          encrypted_blob_path,
          mime_type,
          digest,
          encrypted_size,
          created_at,
          source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          attachment.id,
          attachment.recordId,
          attachment.encryptedBlobPath,
          attachment.mimeType,
          attachment.digest,
          attachment.encryptedSize,
          attachment.createdAt,
          attachment.source
        ]
      );
    }

    for (const reminder of record.reminders) {
      await executor.execute(
        `INSERT OR REPLACE INTO reminders (
          id,
          record_id,
          due_at,
          message,
          days_before,
          repeat,
          status,
          snoozed_until,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reminder.id,
          reminder.recordId,
          reminder.dueAt,
          reminder.message,
          reminder.daysBefore,
          reminder.repeat,
          reminder.status,
          reminder.snoozedUntil ?? null,
          reminder.completedAt ?? null
        ]
      );
    }
  }
}
