const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");
const mobile = await import("../apps/mobile/src/ocr-capture-workflow.ts");

const fixedNow = () => "2026-06-06T00:20:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const manifest = vault.createVaultManifest({
  name: "Mobile OCR Workflow",
  deviceId: "device_mobile_ocr",
  now: fixedNow,
  ids
});

const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);
const capture = mobile.startMobileOcrCapture({
  source: "camera",
  image: {
    encryptedBlobPath: "attachments/mobile-member-card.blob",
    mimeType: "image/jpeg",
    digest: "sha256-mobile-member-card",
    encryptedSize: 1024,
    source: "camera"
  },
  rawText: `Airport Lounge VIP
会员号: LOUNGE-2026
权益 premium travel
到期 2026-12-31
客服电话 400-555-0101`,
  now: fixedNow,
  ids
});

if (capture.ocrDraft.typeSuggestions[0].type !== "membership") {
  throw new Error(`Expected membership capture, got ${capture.ocrDraft.typeSuggestions[0].type}`);
}

const record = mobile.commitMobileOcrCapture({
  repository,
  capture,
  decision: {
    draftId: capture.ocrDraft.id,
    acceptedType: "membership",
    acceptedFieldKeys: ["member_name", "member_id", "expires_at", "service_phone"],
    rejectedFieldKeys: [],
    editedFields: {
      member_name: "Edited Airport Lounge VIP"
    },
    createReminder: true,
    decidedAt: fixedNow()
  },
  encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
  now: fixedNow,
  ids
});

if (repository.listRecords().length !== 1) {
  throw new Error("Expected committed OCR record in repository");
}

if (record.attachments.length !== 1) {
  throw new Error(`Expected original image attachment, got ${record.attachments.length}`);
}

if (record.reminders.length !== 1) {
  throw new Error(`Expected OCR reminder, got ${record.reminders.length}`);
}

if (record.title !== "Edited Airport Lounge VIP") {
  throw new Error(`Expected edited OCR field value to become record title, got ${record.title}`);
}

console.log("Mobile OCR workflow smoke test passed.");
console.log(
  JSON.stringify(
    {
      records: repository.listRecords().length,
      attachments: record.attachments.length,
      reminders: record.reminders.length,
      title: record.title
    },
    null,
    2
  )
);
