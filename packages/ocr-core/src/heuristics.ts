import {
  createRecordDraft,
  getRecordTemplate,
  type IdFactory,
  type RecordDraft,
  type RecordType
} from "../../vault-core/src/index.ts";
import type {
  ExtractedField,
  OcrDraft,
  OcrDraftDecision,
  OcrSource,
  OcrToken,
  RecordTypeSuggestion
} from "./index.ts";

export interface CreateOcrDraftFromTextInput {
  rawText: string;
  imageAttachmentId: string;
  source: OcrSource;
  now?: () => string;
  ids?: IdFactory;
}

export function createOcrDraftFromText(input: CreateOcrDraftFromTextInput): OcrDraft {
  const rawText = input.rawText.trim();
  if (!rawText) {
    throw new Error("OCR raw text must not be empty");
  }

  const now = input.now ?? (() => new Date().toISOString());
  const typeSuggestions = suggestRecordTypes(rawText);
  const acceptedType = typeSuggestions[0]?.type ?? "custom";

  return {
    id: input.ids?.nextId("ocr_draft") ?? `ocr_draft_${Date.now().toString(36)}`,
    source: input.source,
    imageAttachmentId: input.imageAttachmentId,
    rawText,
    tokens: tokenize(rawText),
    typeSuggestions,
    extractedFields: extractFields(rawText, acceptedType),
    createdAt: now()
  };
}

export function suggestRecordTypes(rawText: string): RecordTypeSuggestion[] {
  const text = rawText.toLocaleLowerCase();
  const suggestions: RecordTypeSuggestion[] = [];
  const add = (type: RecordType, confidence: number, reason: string) => {
    suggestions.push({ type, confidence, reason });
  };

  if (hasCardNumber(rawText) || /bank|visa|mastercard|银行卡|银行|卡号/.test(text)) {
    add("bank_card", hasCardNumber(rawText) ? 0.92 : 0.72, "Detected bank/card indicators");
  }
  if (/member|membership|vip|会员|会员号|积分|权益|到期/.test(text)) {
    add("membership", /到期|expires|expiry/.test(text) ? 0.9 : 0.76, "Detected membership indicators");
  }
  if (/passport|identity|driver|身份证|护照|证件|驾照/.test(text)) {
    add("identity_document", 0.84, "Detected identity document indicators");
  }
  if (/api[_ -]?key|secret|token|recovery|备用码|密钥/.test(text)) {
    add("secret_key", 0.86, "Detected key/secret indicators");
  }
  if (/https?:\/\/|www\.|@|username|password|账号|用户名|密码/.test(text)) {
    add("account", 0.76, "Detected login/account indicators");
  }

  add("custom", 0.2, "Fallback custom record");
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

export function extractFields(rawText: string, type: RecordType): ExtractedField[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const text = lines.join("\n");
  const fields: ExtractedField[] = [];
  const push = (field: ExtractedField | undefined) => {
    if (field && !fields.some((item) => item.key === field.key && item.value === field.value)) {
      fields.push(field);
    }
  };

  const firstLine = lines[0];
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const url = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/i)?.[0];
  const phone = text.match(/(?:\+?\d[\d -]{7,}\d)/)?.[0]?.replace(/[ -]/g, "");
  const date = extractFirstDate(text);

  switch (type) {
    case "bank_card":
      push(firstLine ? field("bank_name", "银行", firstLine, "public", 0.62) : undefined);
      push(cardNumberField(text));
      push(date ? field("expiry_date", "有效期", date, "private", 0.7, true) : undefined);
      push(phone ? field("reserved_phone", "预留手机号", phone, "private", 0.58) : undefined);
      break;
    case "membership":
      push(firstLine ? field("member_name", "会员名称", firstLine, "public", 0.66) : undefined);
      push(memberIdField(text));
      push(date ? field("expires_at", "到期日", date, "private", 0.74, true) : undefined);
      push(phone ? field("service_phone", "客服电话", phone, "public", 0.55) : undefined);
      break;
    case "identity_document":
      push(firstLine ? field("document_type", "证件类型", firstLine, "public", 0.58) : undefined);
      push(documentNumberField(text));
      push(date ? field("expires_at", "有效期", date, "private", 0.72, true) : undefined);
      break;
    case "secret_key":
      push(firstLine ? field("platform", "平台", firstLine, "public", 0.55) : undefined);
      push(secretField(text));
      break;
    case "account":
      push(accountUsernameField(text));
      push(email ? field("email", "绑定邮箱", email, "private", 0.78) : undefined);
      push(phone ? field("phone", "绑定手机号", phone, "private", 0.56) : undefined);
      push(url ? field("url", "网址", url, "public", 0.82) : undefined);
      break;
    case "custom":
      push(field("notes", "备注", rawText, "private", 0.4));
      break;
  }

  return fields.filter((item) => getRecordTemplate(type).fields.some((templateField) => templateField.key === item.key));
}

export function createRecordDraftFromOcrDecision(ocrDraft: OcrDraft, decision: OcrDraftDecision): RecordDraft {
  const acceptedFields = ocrDraft.extractedFields
    .filter((field) => decision.acceptedFieldKeys.includes(field.key))
    .map((field) => ({
      ...field,
      value: normalizeEditedOcrValue(decision.editedFields?.[field.key], field.value)
    }));
  const title = acceptedFields[0]?.value ?? getRecordTemplate(decision.acceptedType).label;
  return createRecordDraft({
    type: decision.acceptedType,
    title,
    values: Object.fromEntries(acceptedFields.map((field) => [field.key, field.value])),
    attachmentIds: [ocrDraft.imageAttachmentId],
    reminderDrafts: decision.createReminder ? createReminderDraftsFromFields(title, acceptedFields) : [],
    source: "ocr"
  });
}

function normalizeEditedOcrValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function createReminderDraftsFromFields(title: string, fields: ExtractedField[]): RecordDraft["reminderDrafts"] {
  return fields
    .filter((field) => field.reminderCandidate && isIsoDateTime(field.value))
    .map((field) => ({
      dueAt: field.value,
      message: `${title} ${field.label}即将到期`,
      daysBefore: 7
    }));
}

function tokenize(rawText: string): OcrToken[] {
  return rawText
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ text, confidence: 0.6 }));
}

function hasCardNumber(rawText: string): boolean {
  return Boolean(rawText.match(/(?:\d[ -]?){13,19}/));
}

function cardNumberField(text: string): ExtractedField | undefined {
  const match = text.match(/(?:\d[ -]?){13,19}/)?.[0];
  if (!match) {
    return undefined;
  }
  return field("card_number", "卡号", match.replace(/\D/g, ""), "secret", 0.84);
}

function memberIdField(text: string): ExtractedField | undefined {
  const match = text.match(/(?:member|会员号|会员|vip|id)[:：#\s]*([A-Z0-9-]{4,})/i)?.[1];
  return match ? field("member_id", "会员号", match, "private", 0.7) : undefined;
}

function documentNumberField(text: string): ExtractedField | undefined {
  const match = text.match(/(?:证件号|身份证|passport|document|id)[:：#\s]*([A-Z0-9-]{6,})/i)?.[1];
  return match ? field("document_number", "证件号码", match, "secret", 0.7) : undefined;
}

function secretField(text: string): ExtractedField | undefined {
  const match = text.match(/(?:secret|token|api[_ -]?key|密钥)[:：=\s]*([A-Za-z0-9_\-.]{8,})/i)?.[1];
  return match ? field("secret", "Secret", match, "critical", 0.76) : undefined;
}

function accountUsernameField(text: string): ExtractedField | undefined {
  const match = text.match(/(?:username|user|账号|用户名)[:：=\s]*([A-Za-z0-9_.@-]{3,})/i)?.[1];
  return match ? field("username", "用户名", match, "private", 0.72) : undefined;
}

function extractFirstDate(text: string): string | undefined {
  const match = text.match(/(20\d{2})[./-](0?[1-9]|1[0-2])[./-](0?[1-9]|[12]\d|3[01])/);
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`;
}

function isIsoDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && value.includes("T");
}

function field(
  key: string,
  label: string,
  value: string,
  sensitivity: ExtractedField["sensitivity"],
  confidence: number,
  reminderCandidate = false
): ExtractedField {
  return {
    key,
    label,
    value,
    sensitivity,
    confidence,
    reminderCandidate
  };
}
