import type { CryptoAdapter, EncryptedPayload, KdfParams, KeyPurpose } from "./index.ts";

export interface WebCryptoAdapterOptions {
  subtle?: SubtleCrypto;
  crypto?: Pick<Crypto, "getRandomValues">;
}

export function createWebCryptoAesGcmAdapter(options: WebCryptoAdapterOptions = {}): CryptoAdapter {
  const subtle = options.subtle ?? globalThis.crypto?.subtle;
  const cryptoObject = options.crypto ?? globalThis.crypto;

  if (!subtle || !cryptoObject?.getRandomValues) {
    throw new Error("WebCrypto AES-GCM adapter requires crypto.subtle and crypto.getRandomValues");
  }

  return {
    profile: "local-vault-v1",

    async deriveKey(password: string, params: KdfParams): Promise<Uint8Array> {
      assertWebCryptoKdfParams(params);
      const passwordKey = await subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
      );
      const bits = await subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: fromBase64(params.saltBase64),
          iterations: params.iterations
        },
        passwordKey,
        256
      );
      return new Uint8Array(bits);
    },

    async encrypt(
      plaintext: Uint8Array,
      key: Uint8Array,
      purpose: KeyPurpose,
      aad?: Uint8Array
    ): Promise<EncryptedPayload> {
      assertAes256Key(key);
      const nonce = randomBytes(12, cryptoObject);
      const cryptoKey = await subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt"]);
      const ciphertext = await subtle.encrypt(
        {
          name: "AES-GCM",
          iv: nonce,
          additionalData: aad
        },
        cryptoKey,
        plaintext
      );
      return {
        profile: "local-vault-v1",
        algorithm: "aes-256-gcm",
        keyPurpose: purpose,
        nonceBase64: toBase64(nonce),
        ciphertextBase64: toBase64(new Uint8Array(ciphertext)),
        aadBase64: aad ? toBase64(aad) : undefined
      };
    },

    async decrypt(payload: EncryptedPayload, key: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
      assertAes256Key(key);
      assertWebCryptoPayload(payload);
      const cryptoKey = await subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["decrypt"]);
      const plaintext = await subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(payload.nonceBase64),
          additionalData: aad
        },
        cryptoKey,
        fromBase64(payload.ciphertextBase64)
      );
      return new Uint8Array(plaintext);
    },

    randomBytes(length: number): Uint8Array {
      return randomBytes(length, cryptoObject);
    }
  };
}

function assertWebCryptoKdfParams(params: KdfParams): void {
  if (params.algorithm !== "pbkdf2-sha256") {
    throw new Error(`WebCrypto adapter requires pbkdf2-sha256 KDF params, got ${params.algorithm}`);
  }
  if (params.iterations < 1) {
    throw new Error("PBKDF2 iterations must be positive");
  }
  if (!params.saltBase64.trim()) {
    throw new Error("PBKDF2 salt must not be empty");
  }
}

function assertWebCryptoPayload(payload: EncryptedPayload): void {
  if (payload.profile !== "local-vault-v1") {
    throw new Error(`Unsupported crypto profile: ${payload.profile}`);
  }
  if (payload.algorithm !== "aes-256-gcm") {
    throw new Error(`Unsupported WebCrypto payload algorithm: ${payload.algorithm}`);
  }
  if (!payload.nonceBase64.trim()) {
    throw new Error("Encrypted payload nonce must not be empty");
  }
  if (!payload.ciphertextBase64.trim()) {
    throw new Error("Encrypted payload ciphertext must not be empty");
  }
}

function assertAes256Key(key: Uint8Array): void {
  if (key.length !== 32) {
    throw new Error(`AES-256-GCM key must be 32 bytes, got ${key.length}`);
  }
}

function randomBytes(length: number, cryptoObject: Pick<Crypto, "getRandomValues">): Uint8Array {
  if (length < 1) {
    throw new Error("Random byte length must be positive");
  }
  const bytes = new Uint8Array(length);
  cryptoObject.getRandomValues(bytes);
  return bytes;
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
