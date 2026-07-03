const ocr = await import("../packages/ocr-core/src/index.ts");

const fixedNow = () => "2026-06-05T17:30:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const draft = ocr.createOcrDraftFromText({
  source: "image_import",
  imageAttachmentId: "attachment_member_card_1",
  rawText: `Streaming Club VIP
会员号: VIP-7788
权益: premium access
到期 2026-08-01
客服电话 400-123-4567`,
  now: fixedNow,
  ids
});

if (draft.typeSuggestions[0].type !== "membership") {
  throw new Error(`Expected membership suggestion, got ${draft.typeSuggestions[0].type}`);
}

const fieldKeys = new Set(draft.extractedFields.map((field) => field.key));
for (const key of ["member_name", "member_id", "expires_at"]) {
  if (!fieldKeys.has(key)) {
    throw new Error(`Expected extracted field: ${key}`);
  }
}

const recordDraft = ocr.createRecordDraftFromOcrDecision(draft, {
  draftId: draft.id,
  acceptedType: "membership",
  acceptedFieldKeys: ["member_name", "member_id", "expires_at", "service_phone"],
  rejectedFieldKeys: [],
  createReminder: true,
  decidedAt: fixedNow()
});

if (recordDraft.source !== "ocr") {
  throw new Error("Expected OCR record draft source");
}

if (recordDraft.attachmentIds[0] !== "attachment_member_card_1") {
  throw new Error("Expected original image attachment id to be preserved");
}

if (recordDraft.reminderDrafts.length !== 1) {
  throw new Error(`Expected 1 reminder draft, got ${recordDraft.reminderDrafts.length}`);
}

console.log("OCR draft smoke test passed.");
console.log(
  JSON.stringify(
    {
      suggestion: draft.typeSuggestions[0].type,
      fields: draft.extractedFields.map((field) => field.key),
      recordDraftType: recordDraft.type,
      attachmentIds: recordDraft.attachmentIds.length,
      reminderDrafts: recordDraft.reminderDrafts.length
    },
    null,
    2
  )
);
