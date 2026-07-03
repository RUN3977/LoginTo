import type {
  AttachmentRef,
  FieldSensitivity,
  RecordDraft,
  RecordFieldValue,
  ReminderRule,
  VaultRecord
} from "./index.ts";
import { assertRecordDraftCanCommit } from "./drafts.ts";
import { createReminderRule } from "./reminders.ts";
import { getRecordTemplate } from "./templates.ts";
import { defaultIdFactory, systemClock, type Clock, type IdFactory } from "./utils.ts";

export interface EncryptFieldValueInput {
  recordId: string;
  key: string;
  value: string;
  sensitivity: FieldSensitivity;
}

export type EncryptFieldValue = (input: EncryptFieldValueInput) => string;

export type AsyncEncryptFieldValue = (input: EncryptFieldValueInput) => Promise<string>;

export interface CreateVaultRecordInput {
  draft: RecordDraft;
  encryptFieldValue: EncryptFieldValue;
  attachments?: AttachmentRef[];
  recordId?: string;
  categoryId?: string;
  tagIds?: string[];
  now?: Clock;
  ids?: IdFactory;
}

export interface CreateVaultRecordAsyncInput extends Omit<CreateVaultRecordInput, "encryptFieldValue"> {
  encryptFieldValue: AsyncEncryptFieldValue;
}

export interface FieldUpdate {
  key: string;
  value: string;
  sensitivity?: FieldSensitivity;
}

export interface UpdateVaultRecordFieldsInput {
  record: VaultRecord;
  updates: FieldUpdate[];
  encryptFieldValue: EncryptFieldValue;
  now?: Clock;
}

export interface UpdateVaultRecordFieldsAsyncInput extends Omit<UpdateVaultRecordFieldsInput, "encryptFieldValue"> {
  encryptFieldValue: AsyncEncryptFieldValue;
}

export function createVaultRecord(input: CreateVaultRecordInput): VaultRecord {
  assertRecordDraftCanCommit(input.draft);

  const ids = input.ids ?? defaultIdFactory;
  const now = input.now ?? systemClock;
  const timestamp = now();
  const recordId = input.recordId ?? ids.nextId("record");

  const fields: RecordFieldValue[] = input.draft.fields.map((field) => ({
    key: field.key,
    valueCipher: input.encryptFieldValue({
      recordId,
      key: field.key,
      value: field.value,
      sensitivity: field.sensitivity
    }),
    sensitivity: field.sensitivity,
    updatedAt: timestamp
  }));

  const reminders = input.draft.reminderDrafts.map((reminder) =>
    createReminderRule({
      recordId,
      dueAt: reminder.dueAt,
      message: reminder.message,
      daysBefore: reminder.daysBefore,
      now,
      ids
    })
  );

  return {
    id: recordId,
    type: input.draft.type,
    title: input.draft.title.trim(),
    categoryId: input.categoryId,
    tagIds: input.tagIds ?? [],
    favorite: false,
    archived: false,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    fields,
    attachments: input.attachments ?? [],
    reminders
  };
}

export async function createVaultRecordAsync(input: CreateVaultRecordAsyncInput): Promise<VaultRecord> {
  assertRecordDraftCanCommit(input.draft);

  const ids = input.ids ?? defaultIdFactory;
  const now = input.now ?? systemClock;
  const timestamp = now();
  const recordId = input.recordId ?? ids.nextId("record");

  const fields: RecordFieldValue[] = await Promise.all(
    input.draft.fields.map(async (field) => ({
      key: field.key,
      valueCipher: await input.encryptFieldValue({
        recordId,
        key: field.key,
        value: field.value,
        sensitivity: field.sensitivity
      }),
      sensitivity: field.sensitivity,
      updatedAt: timestamp
    }))
  );

  const reminders = input.draft.reminderDrafts.map((reminder) =>
    createReminderRule({
      recordId,
      dueAt: reminder.dueAt,
      message: reminder.message,
      daysBefore: reminder.daysBefore,
      now,
      ids
    })
  );

  return {
    id: recordId,
    type: input.draft.type,
    title: input.draft.title.trim(),
    categoryId: input.categoryId,
    tagIds: input.tagIds ?? [],
    favorite: false,
    archived: false,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    fields,
    attachments: input.attachments ?? [],
    reminders
  };
}

export function updateVaultRecord(
  record: VaultRecord,
  patch: Partial<Pick<VaultRecord, "title" | "categoryId" | "tagIds" | "favorite" | "archived">>,
  now: Clock = systemClock
): VaultRecord {
  return {
    ...record,
    ...patch,
    title: patch.title?.trim() ?? record.title,
    tagIds: patch.tagIds ? [...patch.tagIds] : record.tagIds,
    version: record.version + 1,
    updatedAt: now()
  };
}

export function updateVaultRecordFields(input: UpdateVaultRecordFieldsInput): VaultRecord {
  if (input.updates.length === 0) {
    return input.record;
  }

  const template = getRecordTemplate(input.record.type);
  const templateFields = new Map(template.fields.map((field) => [field.key, field]));
  const timestamp = (input.now ?? systemClock)();
  const fieldsByKey = new Map(input.record.fields.map((field) => [field.key, field]));

  for (const update of input.updates) {
    const templateField = templateFields.get(update.key);
    if (!templateField) {
      throw new Error(`Unknown field key for ${input.record.type}: ${update.key}`);
    }

    const sensitivity = update.sensitivity ?? templateField.sensitivity;
    const encrypted: RecordFieldValue = {
      key: update.key,
      sensitivity,
      valueCipher: input.encryptFieldValue({
        recordId: input.record.id,
        key: update.key,
        value: update.value,
        sensitivity
      }),
      updatedAt: timestamp
    };
    fieldsByKey.set(update.key, encrypted);
  }

  return {
    ...input.record,
    fields: Array.from(fieldsByKey.values()),
    version: input.record.version + 1,
    updatedAt: timestamp
  };
}

export async function updateVaultRecordFieldsAsync(input: UpdateVaultRecordFieldsAsyncInput): Promise<VaultRecord> {
  if (input.updates.length === 0) {
    return input.record;
  }

  const template = getRecordTemplate(input.record.type);
  const templateFields = new Map(template.fields.map((field) => [field.key, field]));
  const timestamp = (input.now ?? systemClock)();
  const fieldsByKey = new Map(input.record.fields.map((field) => [field.key, field]));

  for (const update of input.updates) {
    const templateField = templateFields.get(update.key);
    if (!templateField) {
      throw new Error(`Unknown field key for ${input.record.type}: ${update.key}`);
    }

    const sensitivity = update.sensitivity ?? templateField.sensitivity;
    const encrypted: RecordFieldValue = {
      key: update.key,
      sensitivity,
      valueCipher: await input.encryptFieldValue({
        recordId: input.record.id,
        key: update.key,
        value: update.value,
        sensitivity
      }),
      updatedAt: timestamp
    };
    fieldsByKey.set(update.key, encrypted);
  }

  return {
    ...input.record,
    fields: Array.from(fieldsByKey.values()),
    version: input.record.version + 1,
    updatedAt: timestamp
  };
}

export function addRecordAttachment(record: VaultRecord, attachment: AttachmentRef, now: Clock = systemClock): VaultRecord {
  if (attachment.recordId !== record.id) {
    throw new Error(`Attachment recordId mismatch: expected ${record.id}, got ${attachment.recordId}`);
  }

  if (record.attachments.some((item) => item.id === attachment.id)) {
    throw new Error(`Attachment already exists: ${attachment.id}`);
  }

  return {
    ...record,
    attachments: [...record.attachments, attachment],
    version: record.version + 1,
    updatedAt: now()
  };
}

export function removeRecordAttachment(record: VaultRecord, attachmentId: string, now: Clock = systemClock): VaultRecord {
  const nextAttachments = record.attachments.filter((attachment) => attachment.id !== attachmentId);
  if (nextAttachments.length === record.attachments.length) {
    throw new Error(`Attachment does not exist: ${attachmentId}`);
  }

  return {
    ...record,
    attachments: nextAttachments,
    version: record.version + 1,
    updatedAt: now()
  };
}

export function addRecordReminder(record: VaultRecord, reminder: ReminderRule, now: Clock = systemClock): VaultRecord {
  if (reminder.recordId !== record.id) {
    throw new Error(`Reminder recordId mismatch: expected ${record.id}, got ${reminder.recordId}`);
  }

  if (record.reminders.some((item) => item.id === reminder.id)) {
    throw new Error(`Reminder already exists: ${reminder.id}`);
  }

  return {
    ...record,
    reminders: [...record.reminders, reminder],
    version: record.version + 1,
    updatedAt: now()
  };
}

export function replaceRecordReminder(record: VaultRecord, reminder: ReminderRule, now: Clock = systemClock): VaultRecord {
  if (reminder.recordId !== record.id) {
    throw new Error(`Reminder recordId mismatch: expected ${record.id}, got ${reminder.recordId}`);
  }

  let replaced = false;
  const reminders = record.reminders.map((item) => {
    if (item.id !== reminder.id) {
      return item;
    }
    replaced = true;
    return reminder;
  });

  if (!replaced) {
    throw new Error(`Reminder does not exist: ${reminder.id}`);
  }

  return {
    ...record,
    reminders,
    version: record.version + 1,
    updatedAt: now()
  };
}

export function removeRecordReminder(record: VaultRecord, reminderId: string, now: Clock = systemClock): VaultRecord {
  const nextReminders = record.reminders.filter((reminder) => reminder.id !== reminderId);
  if (nextReminders.length === record.reminders.length) {
    throw new Error(`Reminder does not exist: ${reminderId}`);
  }

  return {
    ...record,
    reminders: nextReminders,
    version: record.version + 1,
    updatedAt: now()
  };
}
