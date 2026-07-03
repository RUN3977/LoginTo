const crypto = await import("../packages/crypto-core/src/index.ts");
const vault = await import("../packages/vault-core/src/index.ts");

const adapter = crypto.createWebCryptoAesGcmAdapter();

if (crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS.iterations < 600_000) {
  throw new Error("Expected WebCrypto PBKDF2 default iterations to be at least 600,000");
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

const kdfParams = {
  ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  iterations: 20_000,
  saltBase64: toBase64(adapter.randomBytes(16))
};

const conformance = await crypto.assertCryptoAdapterConformance(adapter, {
  kdfParams,
  password: "webcrypto-smoke-password"
});

const key = await adapter.deriveKey("webcrypto-smoke-password", kdfParams);
const encryptFieldValue = crypto.createCryptoFieldEncryptor({
  adapter,
  key,
  aadPrefix: "webcrypto-smoke"
});

const fixedNow = () => "2026-06-06T14:00:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const draft = vault.createRecordDraft({
  type: "account",
  title: "WebCrypto Login",
  values: {
    username: "webcrypto-user",
    password: "webcrypto-secret",
    url: "https://webcrypto.example"
  }
});

const record = await vault.createVaultRecordAsync({
  draft,
  encryptFieldValue,
  now: fixedNow,
  ids
});

const passwordField = record.fields.find((field) => field.key === "password");
if (!passwordField?.valueCipher.startsWith(`${crypto.FIELD_CIPHER_FORMAT}:`)) {
  throw new Error("Expected WebCrypto field cipher format");
}

const decryptedPassword = await crypto.decryptCryptoFieldValue({
  adapter,
  key,
  recordId: record.id,
  fieldKey: "password",
  sensitivity: "secret",
  valueCipher: passwordField.valueCipher,
  aadPrefix: "webcrypto-smoke"
});

if (decryptedPassword !== "webcrypto-secret") {
  throw new Error("Expected decrypted field value to match original password");
}

console.log("WebCrypto adapter smoke test passed.");
console.log(
  JSON.stringify(
    {
      adapterProfile: conformance.adapterProfile,
      checks: conformance.checks.length,
      algorithm: crypto.parseCryptoFieldCipher(passwordField.valueCipher).algorithm,
      cipherFormat: passwordField.valueCipher.split(":")[0],
      decrypted: decryptedPassword === "webcrypto-secret"
    },
    null,
    2
  )
);
