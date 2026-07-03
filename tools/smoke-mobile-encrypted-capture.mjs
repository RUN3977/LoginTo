const crypto = await import("../packages/crypto-core/src/index.ts");
const vault = await import("../packages/vault-core/src/index.ts");
const encryptedCapture = await import("../apps/mobile/src/encrypted-capture.ts");
const mobile = await import("../apps/mobile/src/ocr-capture-workflow.ts");

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

const fixedNow = () => "2026-06-06T14:50:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const adapter = crypto.createWebCryptoAesGcmAdapter();
const key = await adapter.deriveKey("mobile-capture-smoke-password", {
  ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  iterations: 20_000,
  saltBase64: toBase64(adapter.randomBytes(16))
});

const prepared = await encryptedCapture.prepareMobileEncryptedCapture({
  adapter,
  key,
  plaintext: new TextEncoder().encode("fake card image bytes"),
  mimeType: "image/jpeg",
  source: "camera",
  aadPrefix: "mobile-capture-smoke",
  ids
});

const encryptedBlob = crypto.parseEncryptedAttachmentBlob(prepared.encryptedBlobJson);
const decrypted = await crypto.decryptAttachmentBlob({
  adapter,
  key,
  blob: encryptedBlob,
  aadPrefix: "mobile-capture-smoke"
});

if (new TextDecoder().decode(decrypted) !== "fake card image bytes") {
  throw new Error("Expected prepared encrypted capture to decrypt");
}

const manifest = vault.createVaultManifest({
  name: "Mobile Encrypted Capture",
  deviceId: "device_mobile_capture",
  now: fixedNow,
  ids
});
const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);
const capture = mobile.startMobileOcrCapture({
  source: "camera",
  imageAttachmentId: prepared.imageAttachmentId,
  image: prepared.image,
  rawText: `Studio Plus
会员号 SP-2026
到期 2026-12-31
客服电话 400-555-0145`,
  now: fixedNow,
  ids
});

const encryptFieldValue = crypto.createCryptoFieldEncryptor({
  adapter,
  key,
  aadPrefix: "mobile-capture-field-smoke"
});

const record = await mobile.commitMobileOcrCaptureAsync({
  repository,
  capture,
  decision: {
    draftId: capture.ocrDraft.id,
    acceptedType: "membership",
    acceptedFieldKeys: ["member_name", "member_id", "expires_at", "service_phone"],
    rejectedFieldKeys: [],
    createReminder: true,
    decidedAt: fixedNow()
  },
  encryptFieldValue,
  now: fixedNow,
  ids
});

if (record.attachments[0]?.id !== prepared.imageAttachmentId) {
  throw new Error("Expected OCR record attachment id to match encrypted capture id");
}

if (record.attachments[0].digest !== encryptedBlob.digestSha256Base64) {
  throw new Error("Expected OCR attachment metadata to use encrypted capture digest");
}

console.log("Mobile encrypted capture smoke test passed.");
console.log(
  JSON.stringify(
    {
      attachmentId: prepared.imageAttachmentId,
      encryptedSize: prepared.image.encryptedSize,
      recordAttachments: record.attachments.length,
      reminders: record.reminders.length
    },
    null,
    2
  )
);
