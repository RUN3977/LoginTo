import {
  getDueReminderAlerts,
  getUpcomingReminderAlerts,
  type Category,
  type InMemoryVaultRepository,
  type ReminderAlert,
  type VaultRecord
} from "../../../packages/vault-core/src/index.ts";

export interface MobileViewStateOptions {
  query?: string;
  now: string;
}

export interface MobileRecordTile {
  id: string;
  title: string;
  type: VaultRecord["type"];
  favorite: boolean;
  categoryId?: string;
  updatedAt: string;
  reminderCount: number;
  attachmentCount: number;
  notesPreview: string;
  attachments: Array<{
    id: string;
    mimeType: string;
    source: string;
    encryptedBlobPath: string;
    encryptedSize: number;
    encrypted: boolean;
  }>;
}

export interface MobileCategoryShortcut {
  id: string;
  label: string;
  icon: string;
  count: number;
}

export interface MobileVaultStats {
  totalRecords: number;
  favoriteRecords: number;
  dueAlerts: number;
  upcomingAlerts: number;
}

export interface MobileVaultViewState {
  vaultName: string;
  query: string;
  stats: MobileVaultStats;
  categories: MobileCategoryShortcut[];
  records: MobileRecordTile[];
  favorites: MobileRecordTile[];
  recent: MobileRecordTile[];
  dueAlerts: ReminderAlert[];
  upcomingAlerts: ReminderAlert[];
}

export function buildMobileVaultViewState(
  repository: InMemoryVaultRepository,
  options: MobileViewStateOptions
): MobileVaultViewState {
  const query = options.query?.trim() ?? "";
  const allRecords = repository.listRecords();
  const records = query ? repository.searchRecords(query) : allRecords;
  const dueAlerts = getDueReminderAlerts(allRecords, options.now);
  const upcomingAlerts = getUpcomingReminderAlerts(allRecords, options.now, 30);
  const favorites = allRecords.filter((record) => record.favorite).slice(0, 8);
  const recent = allRecords.slice(0, 12);

  return {
    vaultName: repository.getManifest().name,
    query,
    stats: {
      totalRecords: allRecords.length,
      favoriteRecords: favorites.length,
      dueAlerts: dueAlerts.length,
      upcomingAlerts: upcomingAlerts.length
    },
    categories: buildCategoryShortcuts(repository.listCategories(), allRecords),
    records: records.map(toMobileRecordTile),
    favorites: favorites.map(toMobileRecordTile),
    recent: recent.map(toMobileRecordTile),
    dueAlerts,
    upcomingAlerts
  };
}

function buildCategoryShortcuts(categories: Category[], records: VaultRecord[]): MobileCategoryShortcut[] {
  return categories.map((category) => ({
    id: category.id,
    label: category.name,
    icon: category.icon,
    count: records.filter((record) => record.categoryId === category.id).length
  }));
}

function toMobileRecordTile(record: VaultRecord): MobileRecordTile {
  return {
    id: record.id,
    title: record.title,
    type: record.type,
    favorite: record.favorite,
    categoryId: record.categoryId,
    updatedAt: record.updatedAt,
    reminderCount: record.reminders.length,
    attachmentCount: record.attachments.length,
    notesPreview: findUnsafeDevelopmentFieldValue(record, "notes"),
    attachments: record.attachments.map((attachment) => ({
      id: attachment.id,
      mimeType: attachment.mimeType,
      source: attachment.source,
      encryptedBlobPath: attachment.encryptedBlobPath,
      encryptedSize: attachment.encryptedSize,
      encrypted: true
    }))
  };
}

function findUnsafeDevelopmentFieldValue(record: VaultRecord, key: string): string {
  const field = record.fields.find((item) => item.key === key);
  if (!field?.valueCipher.startsWith("unsafe-dev-plain-v1:")) {
    return "";
  }
  try {
    const encoded = field.valueCipher.slice("unsafe-dev-plain-v1:".length);
    const decoded = JSON.parse(fromBase64Utf8(encoded)) as { value?: string };
    return decoded.value ?? "";
  } catch {
    return "";
  }
}

function fromBase64Utf8(value: string): string {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}
