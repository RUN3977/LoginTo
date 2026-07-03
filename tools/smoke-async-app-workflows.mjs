const crypto = await import("../packages/crypto-core/src/index.ts");
const vault = await import("../packages/vault-core/src/index.ts");
const desktopSession = await import("../apps/desktop/src/vault-session.ts");
const mobile = await import("../apps/mobile/src/ocr-capture-workflow.ts");

const fixedNow = () => "2026-06-06T13:25:00.000Z";

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

const adapter = crypto.createWebCryptoAesGcmAdapter();
const key = await adapter.deriveKey("async-app-smoke-password", {
  ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  iterations: 20_000,
  saltBase64: toBase64(adapter.randomBytes(16))
});
const encryptFieldValue = crypto.createCryptoFieldEncryptor({
  adapter,
  key,
  aadPrefix: "async-app-smoke"
});

const storage = new vault.InMemoryVaultStorageAdapter();
const session = await desktopSession.DesktopVaultSession.createNew({
  name: "Async App Session",
  deviceId: "device_desktop_async",
  storage,
  encryptFieldValueAsync: encryptFieldValue,
  now: fixedNow,
  ids
});

const record = await session.addRecordAsync({
  type: "account",
  title: "Async Desktop Login",
  values: {
    username: "async-user",
    password: "async-password",
    url: "https://async.example"
  }
});

const updated = await session.updateRecordFieldsAsync(record.id, [
  {
    key: "email",
    value: "async@example.test"
  }
]);

if (updated.version !== 2) {
  throw new Error(`Expected async desktop update version 2, got ${updated.version}`);
}

let rejectedSyncWrite = false;
try {
  session.addRecord({
    type: "custom",
    title: "Should fail",
    values: {
      notes: "No sync encryptor"
    }
  });
} catch {
  rejectedSyncWrite = true;
}

if (!rejectedSyncWrite) {
  throw new Error("Expected sync desktop write to reject when no sync encryptor is configured");
}

const manifest = vault.createVaultManifest({
  name: "Async Mobile OCR",
  deviceId: "device_mobile_async",
  now: fixedNow,
  ids
});
const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);
const capture = mobile.startMobileOcrCapture({
  source: "camera",
  image: {
    encryptedBlobPath: "attachments/async-mobile-member-card.blob",
    mimeType: "image/jpeg",
    digest: "sha256-async-mobile-member-card",
    encryptedSize: 2048,
    source: "camera"
  },
  rawText: `Yoga Club Gold
会员号 YC-2026
到期 2026-12-31
客服电话 400-555-0123`,
  now: fixedNow,
  ids
});

const mobileRecord = await mobile.commitMobileOcrCaptureAsync({
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

if (repository.listRecords().length !== 1 || mobileRecord.attachments.length !== 1) {
  throw new Error("Expected async mobile OCR record with original attachment");
}

console.log("Async app workflow smoke test passed.");
console.log(
  JSON.stringify(
    {
      desktopRecords: session.getRecords().length,
      desktopVersion: updated.version,
      rejectedSyncWrite,
      mobileRecords: repository.listRecords().length,
      mobileAttachments: mobileRecord.attachments.length
    },
    null,
    2
  )
);
