import type { Category, FieldSensitivity, Tag, VaultRecord } from "./index.ts";
import { getRecordTemplate } from "./templates.ts";

export interface RevealSearchableFieldValueInput {
  recordId: string;
  key: string;
  valueCipher: string;
  sensitivity: FieldSensitivity;
}

export type RevealSearchableFieldValue = (input: RevealSearchableFieldValueInput) => string | undefined;

export interface SearchDocument {
  recordId: string;
  title: string;
  type: VaultRecord["type"];
  categoryId?: string;
  tagIds: string[];
  terms: string[];
  updatedAt: string;
}

export interface BuildSearchDocumentOptions {
  categories?: readonly Category[];
  tags?: readonly Tag[];
  revealFieldValue?: RevealSearchableFieldValue;
}

export function buildSearchDocument(record: VaultRecord, options: BuildSearchDocumentOptions = {}): SearchDocument {
  const template = getRecordTemplate(record.type);
  const templateFields = new Map(template.fields.map((field) => [field.key, field]));
  const categories = new Map((options.categories ?? []).map((category) => [category.id, category]));
  const tags = new Map((options.tags ?? []).map((tag) => [tag.id, tag]));
  const terms = [
    record.title,
    template.label,
    record.categoryId ? categories.get(record.categoryId)?.name : undefined,
    ...record.tagIds.map((tagId) => tags.get(tagId)?.name)
  ];

  for (const field of record.fields) {
    const templateField = templateFields.get(field.key);
    if (!templateField?.searchable) {
      continue;
    }
    if (field.sensitivity === "secret" || field.sensitivity === "critical") {
      continue;
    }
    const value = options.revealFieldValue?.({
      recordId: record.id,
      key: field.key,
      valueCipher: field.valueCipher,
      sensitivity: field.sensitivity
    });
    if (value) {
      terms.push(value);
    }
  }

  return {
    recordId: record.id,
    title: record.title,
    type: record.type,
    categoryId: record.categoryId,
    tagIds: [...record.tagIds],
    terms: normalizeTerms(terms),
    updatedAt: record.updatedAt
  };
}

export function buildSearchIndex(records: readonly VaultRecord[], options: BuildSearchDocumentOptions = {}): SearchDocument[] {
  return records.map((record) => buildSearchDocument(record, options));
}

export function searchRecords(
  records: readonly VaultRecord[],
  query: string,
  options: BuildSearchDocumentOptions = {}
): VaultRecord[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [...records];
  }

  const index = buildSearchIndex(records, options);
  const matchedIds = new Set(
    index
      .filter((document) => document.terms.some((term) => term.includes(normalizedQuery)))
      .map((document) => document.recordId)
  );

  return records.filter((record) => matchedIds.has(record.id));
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeTerms(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map(normalizeSearchText)));
}
