import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  SqliteVaultStorageAdapter,
  initializeSqliteVaultSchema,
  type SqliteExecutor,
  type SqliteQueryResult,
  type SqliteValue
} from "../../../packages/vault-core/src/index.ts";

export class DesktopNodeSqliteExecutor implements SqliteExecutor {
  readonly path: string;
  readonly database: DatabaseSync;
  #transactionDepth = 0;

  constructor(path: string) {
    this.path = path;
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
  }

  async execute(sql: string, params: readonly SqliteValue[] = []): Promise<void> {
    if (params.length === 0 && isSchemaStatement(sql)) {
      this.database.exec(sql);
      return;
    }
    this.database.prepare(sql).run(...params.map(normalizeSqliteValue));
  }

  async query<Row extends Record<string, SqliteValue>>(
    sql: string,
    params: readonly SqliteValue[] = []
  ): Promise<SqliteQueryResult<Row>> {
    const rows = this.database.prepare(sql).all(...params.map(normalizeSqliteValue)) as Row[];
    return { rows };
  }

  async transaction<T>(work: (executor: SqliteExecutor) => Promise<T>): Promise<T> {
    if (this.#transactionDepth > 0) {
      return work(this);
    }

    this.#transactionDepth += 1;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = await work(this);
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      this.#transactionDepth -= 1;
    }
  }

  close(): void {
    this.database.close();
  }
}

export class DesktopSqliteVaultStorageAdapter extends SqliteVaultStorageAdapter {
  readonly path: string;
  readonly desktopExecutor: DesktopNodeSqliteExecutor;

  private constructor(path: string, executor: DesktopNodeSqliteExecutor) {
    super(executor);
    this.path = path;
    this.desktopExecutor = executor;
  }

  static async open(path: string): Promise<DesktopSqliteVaultStorageAdapter> {
    await mkdir(dirname(path), { recursive: true });
    const executor = new DesktopNodeSqliteExecutor(path);
    const storage = new DesktopSqliteVaultStorageAdapter(path, executor);
    await initializeSqliteVaultSchema(executor);
    return storage;
  }

  close(): void {
    this.desktopExecutor.close();
  }
}

function normalizeSqliteValue(value: SqliteValue): string | number | Buffer | null {
  return value instanceof Uint8Array ? Buffer.from(value) : value;
}

function isSchemaStatement(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  return normalized.startsWith("create table")
    || normalized.startsWith("create index")
    || normalized.startsWith("pragma");
}
