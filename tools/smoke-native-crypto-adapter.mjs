import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

const crypto = await import("../packages/crypto-core/src/index.ts");
const vault = await import("../packages/vault-core/src/index.ts");

const provider = {
  async deriveArgon2idKey(input) {
    return new Uint8Array(pbkdf2Sync(
      input.password,
      Buffer.from(input.salt),
      Math.max(input.iterations, 1) * 1000,
      input.length,
      "sha256"
    ));
  },

  async encryptXChaCha20Poly1305(input) {
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(input.key), Buffer.from(input.nonce.slice(0, 12)));
    if (input.aad) {
      cipher.setAAD(Buffer.from(input.aad));
    }
    return new Uint8Array(Buffer.concat([
      cipher.update(Buffer.from(input.plaintext)),
      cipher.final(),
      cipher.getAuthTag()
    ]));
  },

  async decryptXChaCha20Poly1305(input) {
    const ciphertext = Buffer.from(input.ciphertext);
    const body = ciphertext.subarray(0, -16);
    const tag = ciphertext.subarray(-16);
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(input.key), Buffer.from(input.nonce.slice(0, 12)));
    if (input.aad) {
      decipher.setAAD(Buffer.from(input.aad));
    }
    decipher.setAuthTag(tag);
    return new Uint8Array(Buffer.concat([
      decipher.update(body),
      decipher.final()
    ]));
  },

  randomBytes(length) {
    return new Uint8Array(randomBytes(length));
  }
};

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

const adapter = crypto.createNativeXChaCha20Poly1305Adapter({ provider });
const kdfParams = {
  ...crypto.DEFAULT_KDF_PARAMS,
  memoryKiB: 1024,
  iterations: 1,
  saltBase64: toBase64(adapter.randomBytes(16))
};

const conformance = await crypto.assertCryptoAdapterConformance(adapter, {
  kdfParams,
  password: "native-smoke-password"
});

const key = await adapter.deriveKey("native-smoke-password", kdfParams);
const encrypted = await adapter.encrypt(
  new TextEncoder().encode("native adapter payload"),
  key,
  "vault-content",
  new TextEncoder().encode("native-smoke-aad")
);

if (encrypted.algorithm !== "xchacha20-poly1305") {
  throw new Error(`Expected native adapter to emit XChaCha20-Poly1305 payloads, got ${encrypted.algorithm}`);
}

const encryptFieldValue = crypto.createCryptoFieldEncryptor({
  adapter,
  key,
  aadPrefix: "native-smoke"
});

const fixedNow = () => "2026-06-12T10:00:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const record = await vault.createVaultRecordAsync({
  draft: vault.createRecordDraft({
    type: "secret_key",
    title: "Native Recovery Key",
    values: {
      platform: "Recovery",
      secret: "native-secret-2026"
    }
  }),
  encryptFieldValue,
  now: fixedNow,
  ids
});

const secretField = record.fields.find((field) => field.key === "secret");
if (!secretField?.valueCipher.startsWith(`${crypto.FIELD_CIPHER_FORMAT}:`)) {
  throw new Error("Expected native adapter field cipher format");
}

const decryptedSecret = await crypto.decryptCryptoFieldValue({
  adapter,
  key,
  recordId: record.id,
  fieldKey: "secret",
  sensitivity: "critical",
  valueCipher: secretField.valueCipher,
  aadPrefix: "native-smoke"
});

if (decryptedSecret !== "native-secret-2026") {
  throw new Error("Expected native adapter to decrypt field values");
}

let rejectedWebCryptoParams = false;
try {
  await adapter.deriveKey("native-smoke-password", {
    ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
    saltBase64: kdfParams.saltBase64
  });
} catch {
  rejectedWebCryptoParams = true;
}
if (!rejectedWebCryptoParams) {
  throw new Error("Expected native adapter to reject PBKDF2 fallback params");
}

console.log("Native crypto adapter smoke test passed.");
console.log(
  JSON.stringify(
    {
      adapterProfile: conformance.adapterProfile,
      checks: conformance.checks.length,
      algorithm: encrypted.algorithm,
      nonceBytes: Buffer.from(encrypted.nonceBase64, "base64").length,
      fieldCipher: crypto.parseCryptoFieldCipher(secretField.valueCipher).algorithm,
      rejectedWebCryptoParams
    },
    null,
    2
  )
);
