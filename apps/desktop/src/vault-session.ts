import {
  InMemoryVaultRepository,
  createRecordDraft,
  createVaultRecord,
  createVaultRecordAsync,
  createVaultManifest,
  createVaultPackage,
  type AsyncEncryptFieldValue,
  type AttachmentRef,
  type Clock,
  type CreateRecordDraftInput,
  type EncryptFieldValue,
  type EncryptVaultPackagePayload,
  type FieldUpdate,
  type IdFactory,
  type RecordDraft,
  type ReminderRule,
  type Tag,
  type VaultPackage,
  type VaultRecord,
  type VaultStorageAdapter
} from "../../../packages/vault-core/src/index.ts";

export interface DesktopVaultSessionDependencies {
  storage: VaultStorageAdapter;
  encryptFieldValue?: EncryptFieldValue;
  encryptFieldValueAsync?: AsyncEncryptFieldValue;
  now?: Clock;
  ids?: IdFactory;
}

export interface CreateDesktopVaultSessionInput extends DesktopVaultSessionDependencies {
  name: string;
  deviceId: string;
}

export interface LoadDesktopVaultSessionInput extends DesktopVaultSessionDependencies {
  missing?: "return-undefined" | "throw";
}

export interface AddRecordInput extends CreateRecordDraftInput {
  categoryId?: string;
  tagIds?: string[];
  attachments?: AttachmentRef[];
}

export class DesktopVaultSession {
  readonly storage: VaultStorageAdapter;
  readonly encryptFieldValue?: EncryptFieldValue;
  readonly encryptFieldValueAsync?: AsyncEncryptFieldValue;
  readonly now?: Clock;
  readonly ids?: IdFactory;
  readonly repository: InMemoryVaultRepository;

  private constructor(
    repository: InMemoryVaultRepository,
    dependencies: DesktopVaultSessionDependencies
  ) {
    this.repository = repository;
    this.storage = dependencies.storage;
    this.encryptFieldValue = dependencies.encryptFieldValue;
    this.encryptFieldValueAsync = dependencies.encryptFieldValueAsync;
    this.now = dependencies.now;
    this.ids = dependencies.ids;
  }

  static async createNew(input: CreateDesktopVaultSessionInput): Promise<DesktopVaultSession> {
    const manifest = createVaultManifest({
      name: input.name,
      deviceId: input.deviceId,
      now: input.now,
      ids: input.ids
    });
    const repository = new InMemoryVaultRepository(manifest, input.now);
    const session = new DesktopVaultSession(repository, input);
    await session.save();
    return session;
  }

  static async load(input: LoadDesktopVaultSessionInput): Promise<DesktopVaultSession | undefined> {
    const repository = await InMemoryVaultRepository.loadFromStorage(input.storage, input.now);
    if (!repository) {
      if (input.missing === "throw") {
        throw new Error("Vault storage does not exist");
      }
      return undefined;
    }
    return new DesktopVaultSession(repository, input);
  }

  static fromRepository(
    repository: InMemoryVaultRepository,
    dependencies: DesktopVaultSessionDependencies
  ): DesktopVaultSession {
    return new DesktopVaultSession(repository, dependencies);
  }

  getRecords(): VaultRecord[] {
    return this.repository.listRecords();
  }

  getTags(): Tag[] {
    return this.repository.listTags();
  }

  upsertTag(tag: Tag): Tag {
    return this.repository.upsertTag(tag);
  }

  createDraft(input: CreateRecordDraftInput): RecordDraft {
    return createRecordDraft(input);
  }

  addRecord(input: AddRecordInput): VaultRecord {
    const draft = this.createDraft(input);
    const record = createRecordFromDraft({
      draft,
      categoryId: input.categoryId,
      tagIds: input.tagIds,
      attachments: input.attachments,
      encryptFieldValue: this.requireSyncEncryptor(),
      now: this.now,
      ids: this.ids
    });
    return this.repository.insertRecord(record);
  }

  async addRecordAsync(input: AddRecordInput): Promise<VaultRecord> {
    const draft = this.createDraft(input);
    const record = await createVaultRecordAsync({
      draft,
      categoryId: input.categoryId,
      tagIds: input.tagIds,
      attachments: input.attachments,
      encryptFieldValue: this.getAsyncEncryptor(),
      now: this.now,
      ids: this.ids
    });
    return this.repository.insertRecord(record);
  }

  updateRecordFields(recordId: string, updates: FieldUpdate[]): VaultRecord {
    return this.repository.updateRecordFields(recordId, updates, this.requireSyncEncryptor());
  }

  async updateRecordFieldsAsync(recordId: string, updates: FieldUpdate[]): Promise<VaultRecord> {
    return this.repository.updateRecordFieldsAsync(recordId, updates, this.getAsyncEncryptor());
  }

  addAttachment(recordId: string, attachment: AttachmentRef): VaultRecord {
    return this.repository.addAttachment(recordId, attachment);
  }

  addReminder(recordId: string, reminder: ReminderRule): VaultRecord {
    return this.repository.addReminder(recordId, reminder);
  }

  searchRecords(query: string): VaultRecord[] {
    return this.repository.searchRecords(query);
  }

  async save(): Promise<void> {
    await this.repository.saveToStorage(this.storage);
  }

  exportPackage(encryptPayload: EncryptVaultPackagePayload): VaultPackage {
    return createVaultPackage({
      snapshot: this.repository.snapshot(),
      keyPurpose: "backup-package",
      encryptPayload,
      now: this.now,
      ids: this.ids
    });
  }

  private requireSyncEncryptor(): EncryptFieldValue {
    if (!this.encryptFieldValue) {
      throw new Error("Desktop vault session has no synchronous field encryptor");
    }
    return this.encryptFieldValue;
  }

  private getAsyncEncryptor(): AsyncEncryptFieldValue {
    if (this.encryptFieldValueAsync) {
      return this.encryptFieldValueAsync;
    }
    const encryptFieldValue = this.requireSyncEncryptor();
    return async (input) => encryptFieldValue(input);
  }
}

function createRecordFromDraft(input: {
  draft: RecordDraft;
  categoryId?: string;
  tagIds?: string[];
  attachments?: AttachmentRef[];
  encryptFieldValue: EncryptFieldValue;
  now?: Clock;
  ids?: IdFactory;
}): VaultRecord {
  return createVaultRecord(input);
}
