import type { FieldSensitivity, RecordType } from "../../vault-core/src/index.ts";

export type OcrSource = "camera" | "image_import";

export interface OcrToken {
  text: string;
  confidence: number;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  sensitivity: FieldSensitivity;
  confidence: number;
  reminderCandidate?: boolean;
}

export interface RecordTypeSuggestion {
  type: RecordType;
  confidence: number;
  reason: string;
}

export interface OcrDraft {
  id: string;
  source: OcrSource;
  imageAttachmentId: string;
  rawText: string;
  tokens: OcrToken[];
  typeSuggestions: RecordTypeSuggestion[];
  extractedFields: ExtractedField[];
  createdAt: string;
}

export interface OcrDraftDecision {
  draftId: string;
  acceptedType: RecordType;
  acceptedFieldKeys: string[];
  rejectedFieldKeys: string[];
  editedFields?: Record<string, string>;
  createReminder: boolean;
  decidedAt: string;
}

export const OCR_DRAFT_RULES = {
  writeDirectlyToVault: false,
  keepOriginalImageAttachment: true,
  includeRawTextAsPrivateNoteOnlyAfterUserConfirmation: true
} as const;

export {
  createOcrDraftFromText,
  createRecordDraftFromOcrDecision,
  extractFields,
  suggestRecordTypes
} from "./heuristics.ts";
export type { CreateOcrDraftFromTextInput } from "./heuristics.ts";
