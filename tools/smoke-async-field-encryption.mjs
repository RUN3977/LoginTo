const vault = await import("../packages/vault-core/src/index.ts");

const fixedNow = () => "2026-06-06T13:00:00.000Z";

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

async function encryptFieldValue(input) {
  await Promise.resolve();
  return `async-dev-cipher-v1:${input.recordId}:${input.key}:${input.sensitivity}:${Buffer.from(input.value, "utf8").toString("base64")}`;
}

const manifest = vault.createVaultManifest({
  name: "Async Crypto Smoke",
  deviceId: "device_desktop",
  now: fixedNow,
  ids
});

const draft = vault.createRecordDraft({
  type: "account",
  title: "Email",
  values: {
    username: "me@example.com",
    password: "secret-password",
    url: "https://mail.example.com",
    notes: "Primary mailbox"
  }
});

const record = await vault.createVaultRecordAsync({
  draft,
  encryptFieldValue,
  now: fixedNow,
  ids
});

const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);
repository.insertRecord(record);

const updated = await repository.updateRecordFieldsAsync(
  record.id,
  [
    {
      key: "password",
      value: "rotated-secret-password"
    }
  ],
  encryptFieldValue
);

const passwordField = updated.fields.find((field) => field.key === "password");
const expectedRotatedValue = Buffer.from("rotated-secret-password", "utf8").toString("base64");
if (!passwordField?.valueCipher.includes(expectedRotatedValue)) {
  throw new Error("Expected async field update to use the async encryptor");
}

if (!passwordField.valueCipher.startsWith("async-dev-cipher-v1:")) {
  throw new Error("Expected async cipher marker");
}

const storage = new vault.InMemoryVaultStorageAdapter();
await repository.saveToStorage(storage);
const restored = await vault.InMemoryVaultRepository.loadFromStorage(storage, fixedNow);

if (!restored || restored.listRecords()[0].version !== 2) {
  throw new Error("Expected restored async-updated record at version 2");
}

console.log("Async field encryption smoke test passed.");
console.log(
  JSON.stringify(
    {
      fields: updated.fields.length,
      version: updated.version,
      cipherPrefix: passwordField.valueCipher.split(":")[0],
      restoredRecords: restored.listRecords().length
    },
    null,
    2
  )
);
