import {
  InMemoryVaultRepository,
  createAttachmentRef,
  createLocalId,
  createVaultRecord,
  createVaultRecordAsync,
  type AttachmentRef,
  type AsyncEncryptFieldValue,
  type Clock,
  type EncryptFieldValue,
  type IdFactory,
  type VaultRecord
} from "../../../packages/vault-core/src/index.ts";
import {
  createOcrDraftFromText,
  createRecordDraftFromOcrDecision,
  type OcrDraft,
  type OcrDraftDecision,
  type OcrSource
} from "../../../packages/ocr-core/src/index.ts";

export interface MobileCapturedImage {
  encryptedBlobPath: string;
  mimeType: string;
  digest: string;
  encryptedSize: number;
  source: Extract<AttachmentRef["source"], "camera" | "import">;
}

export interface StartMobileOcrCaptureInput {
  rawText: string;
  image: MobileCapturedImage;
  imageAttachmentId?: string;
  source: OcrSource;
  now?: Clock;
  ids?: IdFactory;
}

export interface MobileOcrCaptureSession {
  image: MobileCapturedImage;
  ocrDraft: OcrDraft;
}

export interface CommitMobileOcrCaptureInput {
  repository: InMemoryVaultRepository;
  capture: MobileOcrCaptureSession;
  decision: OcrDraftDecision;
  encryptFieldValue: EncryptFieldValue;
  categoryId?: string;
  tagIds?: string[];
  now?: Clock;
  ids?: IdFactory;
}

export interface CommitMobileOcrCaptureAsyncInput extends Omit<CommitMobileOcrCaptureInput, "encryptFieldValue"> {
  encryptFieldValue: AsyncEncryptFieldValue;
}

export function startMobileOcrCapture(input: StartMobileOcrCaptureInput): MobileOcrCaptureSession {
  const imageAttachmentId = input.imageAttachmentId ?? input.ids?.nextId("attachment") ?? createLocalId("attachment");
  return {
    image: input.image,
    ocrDraft: createOcrDraftFromText({
      rawText: input.rawText,
      imageAttachmentId,
      source: input.source,
      now: input.now,
      ids: input.ids
    })
  };
}

export function commitMobileOcrCapture(input: CommitMobileOcrCaptureInput): VaultRecord {
  if (input.capture.ocrDraft.id !== input.decision.draftId) {
    throw new Error("OCR decision draft id does not match capture draft");
  }

  const recordId = input.ids?.nextId("record") ?? createLocalId("record");
  const recordDraft = createRecordDraftFromOcrDecision(input.capture.ocrDraft, input.decision);
  const attachment = createAttachmentRef({
    id: input.capture.ocrDraft.imageAttachmentId,
    recordId,
    encryptedBlobPath: input.capture.image.encryptedBlobPath,
    mimeType: input.capture.image.mimeType,
    digest: input.capture.image.digest,
    encryptedSize: input.capture.image.encryptedSize,
    source: input.capture.image.source,
    now: input.now,
    ids: input.ids
  });

  const record = createVaultRecord({
    recordId,
    draft: recordDraft,
    attachments: [attachment],
    categoryId: input.categoryId,
    tagIds: input.tagIds,
    encryptFieldValue: input.encryptFieldValue,
    now: input.now,
    ids: input.ids
  });

  return input.repository.insertRecord(record);
}

export async function commitMobileOcrCaptureAsync(input: CommitMobileOcrCaptureAsyncInput): Promise<VaultRecord> {
  if (input.capture.ocrDraft.id !== input.decision.draftId) {
    throw new Error("OCR decision draft id does not match capture draft");
  }

  const recordId = input.ids?.nextId("record") ?? createLocalId("record");
  const recordDraft = createRecordDraftFromOcrDecision(input.capture.ocrDraft, input.decision);
  const attachment = createAttachmentRef({
    id: input.capture.ocrDraft.imageAttachmentId,
    recordId,
    encryptedBlobPath: input.capture.image.encryptedBlobPath,
    mimeType: input.capture.image.mimeType,
    digest: input.capture.image.digest,
    encryptedSize: input.capture.image.encryptedSize,
    source: input.capture.image.source,
    now: input.now,
    ids: input.ids
  });

  const record = await createVaultRecordAsync({
    recordId,
    draft: recordDraft,
    attachments: [attachment],
    categoryId: input.categoryId,
    tagIds: input.tagIds,
    encryptFieldValue: input.encryptFieldValue,
    now: input.now,
    ids: input.ids
  });

  return input.repository.insertRecord(record);
}
