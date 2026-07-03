import type {
  Category,
  InMemoryVaultRepository,
  ReminderRule,
  Tag,
  VaultRecord
} from "../../../packages/vault-core/src/index.ts";

export interface DesktopViewStateOptions {
  query?: string;
  selectedRecordId?: string;
}

export interface DesktopSidebarItem {
  id: string;
  label: string;
  icon: string;
  count: number;
  active: boolean;
}

export interface DesktopRecordListItem {
  id: string;
  title: string;
  type: VaultRecord["type"];
  categoryId?: string;
  tagIds: string[];
  favorite: boolean;
  archived: boolean;
  updatedAt: string;
  reminderCount: number;
  attachmentCount: number;
}

export interface DesktopReminderItem {
  id: string;
  recordId: string;
  recordTitle: string;
  dueAt: string;
  message: string;
  daysBefore: number;
  status: ReminderRule["status"];
}

export interface DesktopSelectedRecord {
  id: string;
  title: string;
  type: VaultRecord["type"];
  categoryId?: string;
  tagIds: string[];
  favorite: boolean;
  archived: boolean;
  fieldCount: number;
  secretFieldCount: number;
  criticalFieldCount: number;
  attachmentCount: number;
  reminderCount: number;
  updatedAt: string;
}

export interface DesktopVaultViewState {
  vaultName: string;
  query: string;
  categories: DesktopSidebarItem[];
  tags: Tag[];
  records: DesktopRecordListItem[];
  selectedRecord?: DesktopSelectedRecord;
  reminders: DesktopReminderItem[];
}

export function buildDesktopVaultViewState(
  repository: InMemoryVaultRepository,
  options: DesktopViewStateOptions = {}
): DesktopVaultViewState {
  const query = options.query?.trim() ?? "";
  const allRecords = repository.listRecords();
  const visibleRecords = query ? repository.searchRecords(query) : allRecords;
  const selectedSource =
    visibleRecords.find((record) => record.id === options.selectedRecordId) ?? visibleRecords[0];

  return {
    vaultName: repository.getManifest().name,
    query,
    categories: buildSidebar(repository.listCategories(), allRecords, selectedSource?.categoryId),
    tags: repository.listTags(),
    records: visibleRecords.map(toRecordListItem),
    selectedRecord: selectedSource ? toSelectedRecord(selectedSource) : undefined,
    reminders: buildReminderItems(allRecords)
  };
}

function buildSidebar(
  categories: Category[],
  records: VaultRecord[],
  selectedCategoryId?: string
): DesktopSidebarItem[] {
  return categories.map((category) => ({
    id: category.id,
    label: category.name,
    icon: category.icon,
    count: records.filter((record) => record.categoryId === category.id).length,
    active: selectedCategoryId === category.id
  }));
}

function toRecordListItem(record: VaultRecord): DesktopRecordListItem {
  return {
    id: record.id,
    title: record.title,
    type: record.type,
    categoryId: record.categoryId,
    tagIds: [...record.tagIds],
    favorite: record.favorite,
    archived: record.archived,
    updatedAt: record.updatedAt,
    reminderCount: record.reminders.length,
    attachmentCount: record.attachments.length
  };
}

function toSelectedRecord(record: VaultRecord): DesktopSelectedRecord {
  return {
    id: record.id,
    title: record.title,
    type: record.type,
    categoryId: record.categoryId,
    tagIds: [...record.tagIds],
    favorite: record.favorite,
    archived: record.archived,
    fieldCount: record.fields.length,
    secretFieldCount: record.fields.filter((field) => field.sensitivity === "secret").length,
    criticalFieldCount: record.fields.filter((field) => field.sensitivity === "critical").length,
    attachmentCount: record.attachments.length,
    reminderCount: record.reminders.length,
    updatedAt: record.updatedAt
  };
}

function buildReminderItems(records: VaultRecord[]): DesktopReminderItem[] {
  return records
    .flatMap((record) =>
      record.reminders
        .filter((reminder) => reminder.status === "scheduled" || reminder.status === "snoozed")
        .map((reminder) => ({
          id: reminder.id,
          recordId: record.id,
          recordTitle: record.title,
          dueAt: reminder.dueAt,
          message: reminder.message,
          daysBefore: reminder.daysBefore,
          status: reminder.status
        }))
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
