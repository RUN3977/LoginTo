import type { AttachmentRef, Category, ReminderRule, Tag, VaultManifest, VaultRecord } from "./index.ts";
import { defaultCategoryIdForRecordType, mergeBuiltInCategories } from "./categories.ts";
import { touchVaultManifest } from "./manifest.ts";
import {
  addRecordAttachment,
  addRecordReminder,
  removeRecordAttachment,
  removeRecordReminder,
  replaceRecordReminder,
  updateVaultRecord,
  updateVaultRecordFields,
  updateVaultRecordFieldsAsync,
  type AsyncEncryptFieldValue,
  type EncryptFieldValue,
  type FieldUpdate
} from "./records.ts";
import {
  createVaultSnapshot,
  type VaultSnapshot,
  type VaultStorageAdapter
} from "./storage.ts";
import { searchRecords, type BuildSearchDocumentOptions } from "./search.ts";
import { cloneValue, systemClock, type Clock } from "./utils.ts";

export type VaultRepositorySnapshot = VaultSnapshot;

export class InMemoryVaultRepository {
  #manifest: VaultManifest;
  #records = new Map<string, VaultRecord>();
  #categories = new Map<string, Category>();
  #tags = new Map<string, Tag>();
  #now: Clock;

  constructor(
    manifest: VaultManifest,
    now: Clock = systemClock,
    records: VaultRecord[] = [],
    categories: Category[] = [],
    tags: Tag[] = []
  ) {
    this.#manifest = cloneValue(manifest);
    this.#now = now;
    for (const category of mergeBuiltInCategories(categories)) {
      this.#categories.set(category.id, cloneValue(category));
    }
    for (const tag of tags) {
      this.#tags.set(tag.id, cloneValue(tag));
    }
    for (const record of records) {
      if (this.#records.has(record.id)) {
        throw new Error(`Duplicate record id: ${record.id}`);
      }
      this.#records.set(record.id, cloneValue(record));
    }
  }

  static fromSnapshot(snapshot: VaultSnapshot, now: Clock = systemClock): InMemoryVaultRepository {
    return new InMemoryVaultRepository(snapshot.manifest, now, snapshot.records, snapshot.categories, snapshot.tags);
  }

  static async loadFromStorage(
    storage: VaultStorageAdapter,
    now: Clock = systemClock
  ): Promise<InMemoryVaultRepository | undefined> {
    const snapshot = await storage.load();
    return snapshot ? InMemoryVaultRepository.fromSnapshot(snapshot, now) : undefined;
  }

  getManifest(): VaultManifest {
    return cloneValue(this.#manifest);
  }

  insertRecord(record: VaultRecord): VaultRecord {
    if (this.#records.has(record.id)) {
      throw new Error(`Record already exists: ${record.id}`);
    }
    const normalizedRecord = {
      ...record,
      categoryId: record.categoryId ?? defaultCategoryIdForRecordType(record.type)
    };
    this.#records.set(record.id, cloneValue(normalizedRecord));
    this.#manifest = touchVaultManifest(this.#manifest, this.#now);
    return cloneValue(normalizedRecord);
  }

  getRecord(recordId: string): VaultRecord | undefined {
    const record = this.#records.get(recordId);
    return record ? cloneValue(record) : undefined;
  }

  listRecords(): VaultRecord[] {
    return Array.from(this.#records.values())
      .map((record) => cloneValue(record))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  searchRecords(query: string, options: Omit<BuildSearchDocumentOptions, "categories" | "tags"> = {}): VaultRecord[] {
    return searchRecords(this.listRecords(), query, {
      ...options,
      categories: this.listCategories(),
      tags: this.listTags()
    });
  }

  listCategories(): Category[] {
    return Array.from(this.#categories.values())
      .map((category) => cloneValue(category))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  getCategory(categoryId: string): Category | undefined {
    const category = this.#categories.get(categoryId);
    return category ? cloneValue(category) : undefined;
  }

  upsertCategory(category: Category): Category {
    this.#categories.set(category.id, cloneValue(category));
    this.#manifest = touchVaultManifest(this.#manifest, this.#now);
    return cloneValue(category);
  }

  deleteCategory(categoryId: string): boolean {
    const category = this.#categories.get(categoryId);
    if (category?.builtIn) {
      throw new Error(`Built-in category cannot be deleted: ${categoryId}`);
    }
    const deleted = this.#categories.delete(categoryId);
    if (deleted) {
      this.#manifest = touchVaultManifest(this.#manifest, this.#now);
    }
    return deleted;
  }

  listTags(): Tag[] {
    return Array.from(this.#tags.values())
      .map((tag) => cloneValue(tag))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getTag(tagId: string): Tag | undefined {
    const tag = this.#tags.get(tagId);
    return tag ? cloneValue(tag) : undefined;
  }

  upsertTag(tag: Tag): Tag {
    this.#tags.set(tag.id, cloneValue(tag));
    this.#manifest = touchVaultManifest(this.#manifest, this.#now);
    return cloneValue(tag);
  }

  deleteTag(tagId: string): boolean {
    const deleted = this.#tags.delete(tagId);
    if (deleted) {
      for (const record of this.#records.values()) {
        if (record.tagIds.includes(tagId)) {
          this.#records.set(record.id, {
            ...record,
            tagIds: record.tagIds.filter((id) => id !== tagId),
            version: record.version + 1,
            updatedAt: this.#now()
          });
        }
      }
      this.#manifest = touchVaultManifest(this.#manifest, this.#now);
    }
    return deleted;
  }

  replaceRecord(record: VaultRecord): VaultRecord {
    if (!this.#records.has(record.id)) {
      throw new Error(`Record does not exist: ${record.id}`);
    }
    this.#records.set(record.id, cloneValue(record));
    this.#manifest = touchVaultManifest(this.#manifest, this.#now);
    return cloneValue(record);
  }

  updateRecordMetadata(
    recordId: string,
    patch: Partial<Pick<VaultRecord, "title" | "categoryId" | "tagIds" | "favorite" | "archived">>
  ): VaultRecord {
    const nextRecord = updateVaultRecord(this.#requireRecord(recordId), patch, this.#now);
    return this.replaceRecord(nextRecord);
  }

  updateRecordFields(recordId: string, updates: FieldUpdate[], encryptFieldValue: EncryptFieldValue): VaultRecord {
    const nextRecord = updateVaultRecordFields({
      record: this.#requireRecord(recordId),
      updates,
      encryptFieldValue,
      now: this.#now
    });
    return this.replaceRecord(nextRecord);
  }

  async updateRecordFieldsAsync(
    recordId: string,
    updates: FieldUpdate[],
    encryptFieldValue: AsyncEncryptFieldValue
  ): Promise<VaultRecord> {
    const nextRecord = await updateVaultRecordFieldsAsync({
      record: this.#requireRecord(recordId),
      updates,
      encryptFieldValue,
      now: this.#now
    });
    return this.replaceRecord(nextRecord);
  }

  addAttachment(recordId: string, attachment: AttachmentRef): VaultRecord {
    const nextRecord = addRecordAttachment(this.#requireRecord(recordId), attachment, this.#now);
    return this.replaceRecord(nextRecord);
  }

  removeAttachment(recordId: string, attachmentId: string): VaultRecord {
    const nextRecord = removeRecordAttachment(this.#requireRecord(recordId), attachmentId, this.#now);
    return this.replaceRecord(nextRecord);
  }

  addReminder(recordId: string, reminder: ReminderRule): VaultRecord {
    const nextRecord = addRecordReminder(this.#requireRecord(recordId), reminder, this.#now);
    return this.replaceRecord(nextRecord);
  }

  replaceReminder(recordId: string, reminder: ReminderRule): VaultRecord {
    const nextRecord = replaceRecordReminder(this.#requireRecord(recordId), reminder, this.#now);
    return this.replaceRecord(nextRecord);
  }

  removeReminder(recordId: string, reminderId: string): VaultRecord {
    const nextRecord = removeRecordReminder(this.#requireRecord(recordId), reminderId, this.#now);
    return this.replaceRecord(nextRecord);
  }

  deleteRecord(recordId: string): boolean {
    const deleted = this.#records.delete(recordId);
    if (deleted) {
      this.#manifest = touchVaultManifest(this.#manifest, this.#now);
    }
    return deleted;
  }

  snapshot(): VaultRepositorySnapshot {
    return createVaultSnapshot(this.getManifest(), this.listRecords(), {
      now: this.#now,
      categories: this.listCategories(),
      tags: this.listTags()
    });
  }

  async saveToStorage(storage: VaultStorageAdapter): Promise<VaultRepositorySnapshot> {
    const snapshot = this.snapshot();
    await storage.save(snapshot);
    return snapshot;
  }

  #requireRecord(recordId: string): VaultRecord {
    const record = this.#records.get(recordId);
    if (!record) {
      throw new Error(`Record does not exist: ${recordId}`);
    }
    return cloneValue(record);
  }
}
