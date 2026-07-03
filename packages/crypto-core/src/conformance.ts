import type { CryptoAdapter, EncryptedPayload, KdfParams } from "./index.ts";

export interface CryptoAdapterConformanceOptions {
  password?: string;
  kdfParams?: KdfParams;
  saltBase64?: string;
  plaintext?: string;
  aad?: string;
}

export interface CryptoAdapterConformanceResult {
  adapterProfile: string;
  checks: string[];
}

export async function assertCryptoAdapterConformance(
  adapter: CryptoAdapter,
  options: CryptoAdapterConformanceOptions = {}
): Promise<CryptoAdapterConformanceResult> {
  const checks: string[] = [];
  const kdfParams: KdfParams = options.kdfParams ?? {
    algorithm: "argon2id",
    memoryKiB: 19456,
    iterations: 2,
    parallelism: 1,
    saltBase64: options.saltBase64 ?? "bG9naW50by1jb25mb3JtYW5jZS1zYWx0"
  };
  const password = options.password ?? "correct horse battery staple";
  const plaintext = new TextEncoder().encode(options.plaintext ?? "LoginTo crypto conformance payload");
  const aad = new TextEncoder().encode(options.aad ?? "loginto-conformance-aad");

  const key = await adapter.deriveKey(password, kdfParams);
  if (!(key instanceof Uint8Array) || key.length === 0) {
    throw new Error("Crypto adapter deriveKey must return non-empty Uint8Array");
  }
  checks.push("deriveKey returns key bytes");

  const first = await adapter.encrypt(plaintext, key, "vault-content", aad);
  assertEncryptedPayload(first);
  checks.push("encrypt returns payload envelope");

  const decrypted = await adapter.decrypt(first, key, aad);
  assertEqualBytes(decrypted, plaintext, "decrypt must return original plaintext");
  checks.push("decrypt roundtrip");

  const second = await adapter.encrypt(plaintext, key, "vault-content", aad);
  assertEncryptedPayload(second);
  if (first.ciphertextBase64 === second.ciphertextBase64 && first.nonceBase64 === second.nonceBase64) {
    throw new Error("Crypto adapter encryption must use a fresh nonce or produce distinct ciphertext");
  }
  checks.push("fresh encryption output");

  let rejectedWrongAad = false;
  try {
    await adapter.decrypt(first, key, new TextEncoder().encode("wrong-aad"));
  } catch {
    rejectedWrongAad = true;
  }
  if (!rejectedWrongAad) {
    throw new Error("Crypto adapter decrypt must reject wrong AAD");
  }
  checks.push("rejects wrong AAD");

  return {
    adapterProfile: adapter.profile,
    checks
  };
}

function assertEncryptedPayload(payload: EncryptedPayload): void {
  if (!payload.profile) {
    throw new Error("Encrypted payload must include profile");
  }
  if (!payload.algorithm) {
    throw new Error("Encrypted payload must include algorithm");
  }
  if (!payload.nonceBase64) {
    throw new Error("Encrypted payload must include nonce");
  }
  if (!payload.ciphertextBase64) {
    throw new Error("Encrypted payload must include ciphertext");
  }
}

function assertEqualBytes(actual: Uint8Array, expected: Uint8Array, message: string): void {
  if (actual.length !== expected.length) {
    throw new Error(message);
  }
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== expected[index]) {
      throw new Error(message);
    }
  }
}
