import type { Category, RecordType, Tag } from "./index.ts";
import { assertNonEmpty, defaultIdFactory, type IdFactory } from "./utils.ts";

export const BUILT_IN_CATEGORIES = [
  { id: "cat_accounts", name: "账号", icon: "user-round-key", sortOrder: 10, builtIn: true },
  { id: "cat_cards", name: "银行卡", icon: "credit-card", sortOrder: 20, builtIn: true },
  { id: "cat_memberships", name: "会员", icon: "badge-check", sortOrder: 30, builtIn: true },
  { id: "cat_documents", name: "证件", icon: "id-card", sortOrder: 40, builtIn: true },
  { id: "cat_keys", name: "密钥", icon: "key-round", sortOrder: 50, builtIn: true },
  { id: "cat_custom", name: "自定义", icon: "square-pen", sortOrder: 60, builtIn: true }
] as const satisfies readonly Category[];

export interface CreateCategoryInput {
  name: string;
  icon?: string;
  sortOrder?: number;
  builtIn?: boolean;
  id?: string;
  ids?: IdFactory;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  id?: string;
  ids?: IdFactory;
}

export function createCategory(input: CreateCategoryInput): Category {
  assertNonEmpty(input.name, "Category name");
  const ids = input.ids ?? defaultIdFactory;
  return {
    id: input.id ?? ids.nextId("category"),
    name: input.name.trim(),
    icon: input.icon ?? "folder",
    sortOrder: input.sortOrder ?? 1000,
    builtIn: input.builtIn ?? false
  };
}

export function createTag(input: CreateTagInput): Tag {
  assertNonEmpty(input.name, "Tag name");
  const ids = input.ids ?? defaultIdFactory;
  return {
    id: input.id ?? ids.nextId("tag"),
    name: input.name.trim(),
    color: input.color ?? "#667085"
  };
}

export function defaultCategoryIdForRecordType(type: RecordType): string {
  switch (type) {
    case "account":
      return "cat_accounts";
    case "bank_card":
      return "cat_cards";
    case "membership":
      return "cat_memberships";
    case "identity_document":
      return "cat_documents";
    case "secret_key":
      return "cat_keys";
    case "custom":
      return "cat_custom";
  }
}

export function mergeBuiltInCategories(categories: readonly Category[] = []): Category[] {
  const byId = new Map<string, Category>();
  for (const category of BUILT_IN_CATEGORIES) {
    byId.set(category.id, { ...category });
  }
  for (const category of categories) {
    byId.set(category.id, { ...category });
  }
  return Array.from(byId.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
