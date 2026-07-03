import type { FieldSensitivity, RecordDraft, RecordType } from "./index.ts";
import { getRecordTemplate } from "./templates.ts";

export interface CreateRecordDraftInput {
  type: RecordType;
  title?: string;
  values?: Record<string, string>;
  source?: RecordDraft["source"];
  attachmentIds?: string[];
  reminderDrafts?: RecordDraft["reminderDrafts"];
}

export function createRecordDraft(input: CreateRecordDraftInput): RecordDraft {
  const template = getRecordTemplate(input.type);
  const fieldMap = new Map(template.fields.map((field) => [field.key, field]));
  const values = input.values ?? {};
  const unknownKeys = Object.keys(values).filter((key) => !fieldMap.has(key));

  if (unknownKeys.length > 0) {
    throw new Error(`Unknown field keys for ${input.type}: ${unknownKeys.join(", ")}`);
  }

  return {
    type: input.type,
    title: input.title?.trim() || template.label,
    fields: Object.entries(values)
      .filter(([, value]) => value.trim().length > 0)
      .map(([key, value]) => {
        const field = fieldMap.get(key);
        return {
          key,
          value,
          sensitivity: field?.sensitivity ?? ("private" satisfies FieldSensitivity)
        };
      }),
    attachmentIds: input.attachmentIds ?? [],
    reminderDrafts: input.reminderDrafts ?? [],
    source: input.source ?? "manual"
  };
}

export function getMissingRequiredFieldKeys(draft: RecordDraft): string[] {
  const template = getRecordTemplate(draft.type);
  const presentKeys = new Set(draft.fields.filter((field) => field.value.trim()).map((field) => field.key));
  return template.fields.filter((field) => field.required && !presentKeys.has(field.key)).map((field) => field.key);
}

export function assertRecordDraftCanCommit(draft: RecordDraft): void {
  if (!draft.title.trim()) {
    throw new Error("Record title must not be empty");
  }

  const template = getRecordTemplate(draft.type);
  const allowedKeys = new Set(template.fields.map((field) => field.key));
  const unknownKeys = draft.fields.map((field) => field.key).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Draft contains unknown field keys: ${unknownKeys.join(", ")}`);
  }

  const missingRequiredKeys = getMissingRequiredFieldKeys(draft);
  if (missingRequiredKeys.length > 0) {
    throw new Error(`Draft is missing required fields: ${missingRequiredKeys.join(", ")}`);
  }
}
