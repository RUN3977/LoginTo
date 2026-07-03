const crypto = await import("../packages/crypto-core/src/index.ts");
const vault = await import("../packages/vault-core/src/index.ts");

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

const adapter = crypto.createWebCryptoAesGcmAdapter();
const key = await adapter.deriveKey("attachment-smoke-password", {
  ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  iterations: 20_000,
  saltBase64: toBase64(adapter.randomBytes(16))
});

const attachmentId = "attachment_photo_1";
const plaintext = new TextEncoder().encode("fake jpeg bytes for local OCR capture");
const encryptedBlob = await crypto.encryptAttachmentBlob({
  adapter,
  key,
  attachmentId,
  mimeType: "image/jpeg",
  source: "camera",
  plaintext,
  aadPrefix: "attachment-smoke"
});

const parsedBlob = crypto.parseEncryptedAttachmentBlob(crypto.serializeEncryptedAttachmentBlob(encryptedBlob));
const decrypted = await crypto.decryptAttachmentBlob({
  adapter,
  key,
  blob: parsedBlob,
  aadPrefix: "attachment-smoke"
});

if (new TextDecoder().decode(decrypted) !== "fake jpeg bytes for local OCR capture") {
  throw new Error("Expected decrypted attachment bytes to match original");
}

const ref = vault.createAttachmentRef({
  id: attachmentId,
  recordId: "record_1",
  encryptedBlobPath: "attachments/attachment_photo_1.blob",
  mimeType: parsedBlob.mimeType,
  digest: parsedBlob.digestSha256Base64,
  encryptedSize: parsedBlob.encryptedSize,
  source: "camera",
  now: () => "2026-06-06T14:25:00.000Z",
  ids: {
    nextId(prefix) {
      return `${prefix}_unused`;
    }
  }
});

if (ref.digest !== parsedBlob.digestSha256Base64 || ref.encryptedSize !== parsedBlob.encryptedSize) {
  throw new Error("Expected attachment ref to mirror encrypted blob metadata");
}

console.log("Attachment encryption smoke test passed.");
console.log(
  JSON.stringify(
    {
      format: parsedBlob.format,
      algorithm: parsedBlob.cipher.algorithm,
      encryptedSize: parsedBlob.encryptedSize,
      digestLength: parsedBlob.digestSha256Base64.length,
      refSource: ref.source
    },
    null,
    2
  )
);
