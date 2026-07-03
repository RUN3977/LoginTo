import type { Category, Tag, VaultManifest, VaultRecord } from "./index.ts";
import { VAULT_SCHEMA_VERSION } from "./constants.ts";
import { cloneValue, isIsoDateTime, systemClock, type Clock } from "./utils.ts";

export const VAULT_SNAPSHOT_VERSION = 1;

export interface VaultSnapshot {
  snapshotVersion: typeof VAULT_SNAPSHOT_VERSION;
  exportedAt: string;
  manifest: VaultManifest;
  categories: Category[];
  tags: Tag[];
  records: VaultRecord[];
}

export interface CreateVaultSnapshotOptions {
  now?: Clock;
  categories?: readonly Category[];
  tags?: readonly Tag[];
}

export interface VaultStorageAdapter {
  exists(): Promise<boolean>;
  load(): Promise<VaultSnapshot | undefined>;
  save(snapshot: VaultSnapshot): Promise<void>;
  delete(): Promise<void>;
}

export function createVaultSnapshot(
  manifest: VaultManifest,
  records: VaultRecord[],
  optionsOrNow: CreateVaultSnapshotOptions | Clock = {}
): VaultSnapshot {
  const options = typeof optionsOrNow === "function" ? { now: optionsOrNow } : optionsOrNow;
  const now = options.now ?? systemClock;
  const snapshot = {
    snapshotVersion: VAULT_SNAPSHOT_VERSION,
    exportedAt: now(),
    manifest: cloneValue(manifest),
    categories: cloneValue([...(options.categories ?? [])]),
    tags: cloneValue([...(options.tags ?? [])]),
    records: cloneValue(records).sort((a, b) => a.id.localeCompare(b.id))
  };

  assertVaultSnapshot(snapshot);
  return snapshot;
}

export function serializeVaultSnapshot(snapshot: VaultSnapshot): string {
  assertVaultSnapshot(snapshot);
  return JSON.stringify(snapshot, null, 2);
}

export function parseVaultSnapshot(json: string): VaultSnapshot {
  const parsed = JSON.parse(json) as VaultSnapshot;
  assertVaultSnapshot(parsed);
  return parsed;
}

export function assertVaultSnapshot(snapshot: VaultSnapshot): void {
  if (snapshot.snapshotVersion !== VAULT_SNAPSHOT_VERSION) {
    throw new Error(`Unsupported vault snapshot version: ${snapshot.snapshotVersion}`);
  }

  if (snapshot.manifest.schemaVersion !== VAULT_SCHEMA_VERSION) {
    throw new Error(`Unsupported vault schema version: ${snapshot.manifest.schemaVersion}`);
  }

  if (!isIsoDateTime(snapshot.exportedAt)) {
    throw new Error("Snapshot exportedAt must be an ISO date-time string");
  }

  const categoryIds = new Set<string>();
  for (const category of snapshot.categories) {
    if (categoryIds.has(category.id)) {
      throw new Error(`Duplicate category id in snapshot: ${category.id}`);
    }
    categoryIds.add(category.id);
  }

  const tagIds = new Set<string>();
  for (const tag of snapshot.tags) {
    if (tagIds.has(tag.id)) {
      throw new Error(`Duplicate tag id in snapshot: ${tag.id}`);
    }
    tagIds.add(tag.id);
  }

  const recordIds = new Set<string>();
  for (const record of snapshot.records) {
    if (recordIds.has(record.id)) {
      throw new Error(`Duplicate record id in snapshot: ${record.id}`);
    }
    recordIds.add(record.id);

    if (record.categoryId && !categoryIds.has(record.categoryId)) {
      throw new Error(`Record ${record.id} references unknown category: ${record.categoryId}`);
    }

    for (const tagId of record.tagIds) {
      if (!tagIds.has(tagId)) {
        throw new Error(`Record ${record.id} references unknown tag: ${tagId}`);
      }
    }

    for (const attachment of record.attachments) {
      if (attachment.recordId !== record.id) {
        throw new Error(`Attachment ${attachment.id} belongs to ${attachment.recordId}, expected ${record.id}`);
      }
    }

    for (const reminder of record.reminders) {
      if (reminder.recordId !== record.id) {
        throw new Error(`Reminder ${reminder.id} belongs to ${reminder.recordId}, expected ${record.id}`);
      }
    }
  }
}

export class InMemoryVaultStorageAdapter implements VaultStorageAdapter {
  #snapshot?: VaultSnapshot;

  constructor(snapshot?: VaultSnapshot) {
    if (snapshot) {
      assertVaultSnapshot(snapshot);
      this.#snapshot = cloneValue(snapshot);
    }
  }

  async exists(): Promise<boolean> {
    return Boolean(this.#snapshot);
  }

  async load(): Promise<VaultSnapshot | undefined> {
    return this.#snapshot ? cloneValue(this.#snapshot) : undefined;
  }

  async save(snapshot: VaultSnapshot): Promise<void> {
    assertVaultSnapshot(snapshot);
    this.#snapshot = cloneValue(snapshot);
  }

  async delete(): Promise<void> {
    this.#snapshot = undefined;
  }
}
