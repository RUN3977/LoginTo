import type { AttachmentRef } from "./index.ts";
import { assertNonEmpty, defaultIdFactory, systemClock, type Clock, type IdFactory } from "./utils.ts";

export interface CreateAttachmentRefInput {
  recordId: string;
  encryptedBlobPath: string;
  mimeType: string;
  digest: string;
  encryptedSize: number;
  source: AttachmentRef["source"];
  id?: string;
  now?: Clock;
  ids?: IdFactory;
}

export function createAttachmentRef(input: CreateAttachmentRefInput): AttachmentRef {
  assertNonEmpty(input.recordId, "Record id");
  assertNonEmpty(input.encryptedBlobPath, "Encrypted blob path");
  assertNonEmpty(input.mimeType, "MIME type");
  assertNonEmpty(input.digest, "Attachment digest");

  if (input.encryptedSize < 0) {
    throw new Error("Encrypted attachment size must not be negative");
  }

  const ids = input.ids ?? defaultIdFactory;
  const now = input.now ?? systemClock;

  return {
    id: input.id ?? ids.nextId("attachment"),
    recordId: input.recordId,
    encryptedBlobPath: input.encryptedBlobPath,
    mimeType: input.mimeType,
    digest: input.digest,
    encryptedSize: input.encryptedSize,
    createdAt: now(),
    source: input.source
  };
}
