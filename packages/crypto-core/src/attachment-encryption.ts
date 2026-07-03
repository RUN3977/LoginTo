import type { CryptoAdapter, EncryptedPayload } from "./index.ts";

export const ATTACHMENT_CIPHER_FORMAT = "loginto-attachment-cipher-v1";

export type AttachmentBlobSource = "camera" | "import" | "sync" | "manual";

export interface AttachmentCipherAadInput {
  attachmentId: string;
  mimeType: string;
  source?: AttachmentBlobSource;
  aadPrefix?: string;
}

export interface EncryptedAttachmentBlob {
  format: typeof ATTACHMENT_CIPHER_FORMAT;
  attachmentId: string;
  mimeType: string;
  source?: AttachmentBlobSource;
  digestSha256Base64: string;
  encryptedSize: number;
  cipher: EncryptedPayload;
}

export interface EncryptAttachmentBlobInput extends AttachmentCipherAadInput {
  adapter: CryptoAdapter;
  key: Uint8Array;
  plaintext: Uint8Array;
}

export interface DecryptAttachmentBlobInput {
  adapter: CryptoAdapter;
  key: Uint8Array;
  blob: EncryptedAttachmentBlob;
  aadPrefix?: string;
}

export async function encryptAttachmentBlob(input: EncryptAttachmentBlobInput): Promise<EncryptedAttachmentBlob> {
  assertAttachmentAadInput(input);
  const aad = createAttachmentCipherAad(input);
  const cipher = await input.adapter.encrypt(input.plaintext, input.key, "attachment-content", aad);
  return {
    format: ATTACHMENT_CIPHER_FORMAT,
    attachmentId: input.attachmentId,
    mimeType: input.mimeType,
    source: input.source,
    digestSha256Base64: await sha256Base64(input.plaintext),
    encryptedSize: fromBase64(cipher.ciphertextBase64).length,
    cipher
  };
}

export async function decryptAttachmentBlob(input: DecryptAttachmentBlobInput): Promise<Uint8Array> {
  assertEncryptedAttachmentBlob(input.blob);
  const plaintext = await input.adapter.decrypt(
    input.blob.cipher,
    input.key,
    createAttachmentCipherAad({
      attachmentId: input.blob.attachmentId,
      mimeType: input.blob.mimeType,
      source: input.blob.source,
      aadPrefix: input.aadPrefix
    })
  );
  const digest = await sha256Base64(plaintext);
  if (digest !== input.blob.digestSha256Base64) {
    throw new Error("Attachment digest mismatch after decrypt");
  }
  return plaintext;
}

export function serializeEncryptedAttachmentBlob(blob: EncryptedAttachmentBlob): string {
  assertEncryptedAttachmentBlob(blob);
  return JSON.stringify(blob, null, 2);
}

export function parseEncryptedAttachmentBlob(json: string): EncryptedAttachmentBlob {
  const parsed = JSON.parse(json) as EncryptedAttachmentBlob;
  assertEncryptedAttachmentBlob(parsed);
  return parsed;
}

export function assertEncryptedAttachmentBlob(blob: EncryptedAttachmentBlob): void {
  if (blob.format !== ATTACHMENT_CIPHER_FORMAT) {
    throw new Error(`Unsupported attachment cipher format: ${blob.format}`);
  }
  assertAttachmentAadInput(blob);
  if (!blob.digestSha256Base64.trim()) {
    throw new Error("Encrypted attachment digest must not be empty");
  }
  if (blob.encryptedSize < 1) {
    throw new Error("Encrypted attachment size must be positive");
  }
  if (blob.cipher.keyPurpose !== "attachment-content") {
    throw new Error(`Encrypted attachment key purpose must be attachment-content, got ${blob.cipher.keyPurpose}`);
  }
}

export function createAttachmentCipherAad(input: AttachmentCipherAadInput): Uint8Array {
  assertAttachmentAadInput(input);
  return new TextEncoder().encode(
    JSON.stringify({
      scope: input.aadPrefix ?? "loginto-attachment",
      attachmentId: input.attachmentId,
      mimeType: input.mimeType,
      source: input.source
    })
  );
}

function assertAttachmentAadInput(input: AttachmentCipherAadInput): void {
  if (!input.attachmentId.trim()) {
    throw new Error("Attachment id must not be empty");
  }
  if (!input.mimeType.trim()) {
    throw new Error("Attachment MIME type must not be empty");
  }
}

async function sha256Base64(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Attachment digest requires crypto.subtle");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toBase64(new Uint8Array(digest));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
