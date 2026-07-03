export { VAULT_SCHEMA_VERSION } from "./constants.ts";

export type RecordType =
  | "account"
  | "bank_card"
  | "membership"
  | "identity_document"
  | "secret_key"
  | "custom";

export type FieldSensitivity = "public" | "private" | "secret" | "critical";

export type FieldKind =
  | "text"
  | "password"
  | "url"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "textarea"
  | "otp_backup"
  | "attachment";

export type ReminderStatus = "scheduled" | "snoozed" | "done" | "disabled";

export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface RecordTemplateField {
  key: string;
  label: string;
  kind: FieldKind;
  sensitivity: FieldSensitivity;
  required: boolean;
  searchable: boolean;
  reminderCandidate?: boolean;
  placeholder?: string;
}

export interface RecordTemplate {
  type: RecordType;
  label: string;
  icon: string;
  description: string;
  defaultReminderDaysBefore?: number;
  fields: RecordTemplateField[];
}

export interface VaultManifest {
  vaultId: string;
  name: string;
  schemaVersion: typeof VAULT_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
  cryptoProfile: string;
}

export interface RecordFieldValue {
  key: string;
  valueCipher: string;
  sensitivity: FieldSensitivity;
  updatedAt: string;
}

export interface AttachmentRef {
  id: string;
  recordId: string;
  encryptedBlobPath: string;
  mimeType: string;
  digest: string;
  encryptedSize: number;
  createdAt: string;
  source: "camera" | "import" | "sync" | "manual";
}

export interface ReminderRule {
  id: string;
  recordId: string;
  dueAt: string;
  message: string;
  daysBefore: number;
  repeat: ReminderRepeat;
  status: ReminderStatus;
  snoozedUntil?: string;
  completedAt?: string;
}

export interface VaultRecord {
  id: string;
  type: RecordType;
  title: string;
  categoryId?: string;
  tagIds: string[];
  favorite: boolean;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  fields: RecordFieldValue[];
  attachments: AttachmentRef[];
  reminders: ReminderRule[];
}

export interface RecordDraft {
  type: RecordType;
  title: string;
  fields: Array<{
    key: string;
    value: string;
    sensitivity: FieldSensitivity;
    confidence?: number;
  }>;
  attachmentIds: string[];
  reminderDrafts: Array<{
    dueAt: string;
    message: string;
    daysBefore: number;
  }>;
  source: "manual" | "ocr" | "sync_import";
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  builtIn: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export { RECORD_TEMPLATES, getRecordTemplate } from "./templates.ts";
export { createVaultManifest, touchVaultManifest } from "./manifest.ts";
export type { CreateVaultManifestInput } from "./manifest.ts";
export {
  BUILT_IN_CATEGORIES,
  createCategory,
  createTag,
  defaultCategoryIdForRecordType,
  mergeBuiltInCategories
} from "./categories.ts";
export type { CreateCategoryInput, CreateTagInput } from "./categories.ts";
export { createRecordDraft, assertRecordDraftCanCommit, getMissingRequiredFieldKeys } from "./drafts.ts";
export type { CreateRecordDraftInput } from "./drafts.ts";
export {
  addRecordAttachment,
  addRecordReminder,
  createVaultRecord,
  createVaultRecordAsync,
  removeRecordAttachment,
  removeRecordReminder,
  replaceRecordReminder,
  updateVaultRecord,
  updateVaultRecordFields,
  updateVaultRecordFieldsAsync
} from "./records.ts";
export type {
  AsyncEncryptFieldValue,
  CreateVaultRecordAsyncInput,
  CreateVaultRecordInput,
  EncryptFieldValue,
  EncryptFieldValueInput,
  FieldUpdate,
  UpdateVaultRecordFieldsAsyncInput,
  UpdateVaultRecordFieldsInput
} from "./records.ts";
export { createReminderRule, snoozeReminder, completeReminder } from "./reminders.ts";
export type { CreateReminderRuleInput } from "./reminders.ts";
export {
  createReminderAlert,
  getDueReminderAlerts,
  getReminderTriggerAt,
  getUpcomingReminderAlerts
} from "./reminder-engine.ts";
export type { ReminderAlert } from "./reminder-engine.ts";
export {
  REMINDER_NOTIFICATION_STATE_VERSION,
  ReminderNotificationCenter,
  assertReminderNotificationState,
  createReminderNotificationAlertId,
  createReminderNotificationState,
  parseReminderNotificationState,
  serializeReminderNotificationState
} from "./reminder-notifications.ts";
export type {
  ReminderNotificationDelivery,
  ReminderNotificationState,
  ReminderNotificationStatus
} from "./reminder-notifications.ts";
export {
  createTerminalReminderNotificationActionRequest,
  createTerminalReminderNotificationPayload,
  deliverTerminalReminderNotifications
} from "./terminal-notifications.ts";
export type {
  DeliverTerminalReminderNotificationsInput,
  TerminalNotificationAdapter,
  TerminalNotificationPermission,
  TerminalNotificationPermissionStatus,
  TerminalNotificationShown,
  TerminalReminderNotificationAction,
  TerminalReminderNotificationActionButton,
  TerminalReminderNotificationActionRequest,
  TerminalReminderNotificationDispatch,
  TerminalReminderNotificationDispatchStatus,
  TerminalReminderNotificationPayload
} from "./terminal-notifications.ts";
export { createAttachmentRef } from "./attachments.ts";
export type { CreateAttachmentRefInput } from "./attachments.ts";
export { InMemoryVaultRepository } from "./repository.ts";
export type { VaultRepositorySnapshot } from "./repository.ts";
export {
  VAULT_SNAPSHOT_VERSION,
  InMemoryVaultStorageAdapter,
  assertVaultSnapshot,
  createVaultSnapshot,
  parseVaultSnapshot,
  serializeVaultSnapshot
} from "./storage.ts";
export type { CreateVaultSnapshotOptions, VaultSnapshot, VaultStorageAdapter } from "./storage.ts";
export {
  buildSearchDocument,
  buildSearchIndex,
  normalizeSearchText,
  searchRecords
} from "./search.ts";
export type {
  BuildSearchDocumentOptions,
  RevealSearchableFieldValue,
  RevealSearchableFieldValueInput,
  SearchDocument
} from "./search.ts";
export {
  SQLITE_SCHEMA_STATEMENTS,
  SQLITE_SCHEMA_VERSION,
  SqliteVaultStorageAdapter,
  assertSqliteSchemaStatements,
  initializeSqliteVaultSchema
} from "./sqlite.ts";
export type { SqliteExecutor, SqliteQueryResult, SqliteValue, SqliteVaultStorageOptions } from "./sqlite.ts";
export {
  VAULT_PACKAGE_FORMAT,
  assertVaultPackage,
  createVaultPackage,
  createVaultPackageAsync,
  createVaultPackageAad,
  parseVaultPackage,
  restoreSnapshotFromVaultPackage,
  restoreSnapshotFromVaultPackageAsync,
  serializeVaultPackage
} from "./vault-package.ts";
export type {
  AsyncDecryptVaultPackagePayload,
  AsyncEncryptVaultPackagePayload,
  CreateVaultPackageAsyncInput,
  DecryptVaultPackagePayload,
  DecryptVaultPackagePayloadInput,
  EncryptVaultPackagePayload,
  EncryptVaultPackagePayloadInput,
  VaultCipherEnvelope,
  VaultPackage,
  VaultPackageAttachmentEntry
} from "./vault-package.ts";
export { createLocalId, defaultIdFactory, systemClock } from "./utils.ts";
export type { Clock, IdFactory } from "./utils.ts";
