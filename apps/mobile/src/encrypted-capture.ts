import {
  encryptAttachmentBlob,
  serializeEncryptedAttachmentBlob,
  type CryptoAdapter
} from "../../../packages/crypto-core/src/index.ts";
import {
  createLocalId,
  type AttachmentRef,
  type IdFactory
} from "../../../packages/vault-core/src/index.ts";
import type { MobileCapturedImage } from "./ocr-capture-workflow.ts";

export interface PrepareMobileEncryptedCaptureInput {
  adapter: CryptoAdapter;
  key: Uint8Array;
  plaintext: Uint8Array;
  mimeType: string;
  source: Extract<AttachmentRef["source"], "camera" | "import">;
  encryptedBlobPath?: string;
  imageAttachmentId?: string;
  aadPrefix?: string;
  ids?: IdFactory;
}

export interface PreparedMobileEncryptedCapture {
  imageAttachmentId: string;
  image: MobileCapturedImage;
  encryptedBlobJson: string;
}

export async function prepareMobileEncryptedCapture(
  input: PrepareMobileEncryptedCaptureInput
): Promise<PreparedMobileEncryptedCapture> {
  const imageAttachmentId = input.imageAttachmentId ?? input.ids?.nextId("attachment") ?? createLocalId("attachment");
  const encryptedBlob = await encryptAttachmentBlob({
    adapter: input.adapter,
    key: input.key,
    attachmentId: imageAttachmentId,
    mimeType: input.mimeType,
    source: input.source,
    plaintext: input.plaintext,
    aadPrefix: input.aadPrefix
  });

  return {
    imageAttachmentId,
    image: {
      encryptedBlobPath: input.encryptedBlobPath ?? `attachments/${imageAttachmentId}.blob`,
      mimeType: input.mimeType,
      digest: encryptedBlob.digestSha256Base64,
      encryptedSize: encryptedBlob.encryptedSize,
      source: input.source
    },
    encryptedBlobJson: serializeEncryptedAttachmentBlob(encryptedBlob)
  };
}
