import type { CryptoAdapter, EncryptedPayload, KdfParams, KeyPurpose } from "./index.ts";

export interface NativeArgon2idDeriveKeyInput {
  password: string;
  salt: Uint8Array;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  length: number;
}

export interface NativeXChaCha20Poly1305EncryptInput {
  plaintext: Uint8Array;
  key: Uint8Array;
  nonce: Uint8Array;
  aad?: Uint8Array;
}

export interface NativeXChaCha20Poly1305DecryptInput {
  ciphertext: Uint8Array;
  key: Uint8Array;
  nonce: Uint8Array;
  aad?: Uint8Array;
}

export interface NativeCryptoProvider {
  deriveArgon2idKey(input: NativeArgon2idDeriveKeyInput): Promise<Uint8Array>;
  encryptXChaCha20Poly1305(input: NativeXChaCha20Poly1305EncryptInput): Promise<Uint8Array>;
  decryptXChaCha20Poly1305(input: NativeXChaCha20Poly1305DecryptInput): Promise<Uint8Array>;
  randomBytes(length: number): Uint8Array;
}

export interface NativeCryptoAdapterOptions {
  provider: NativeCryptoProvider;
}

export function createNativeXChaCha20Poly1305Adapter(options: NativeCryptoAdapterOptions): CryptoAdapter {
  const provider = options.provider;
  return {
    profile: "local-vault-v1",

    async deriveKey(password: string, params: KdfParams): Promise<Uint8Array> {
      assertNativeKdfParams(params);
      const key = await provider.deriveArgon2idKey({
        password,
        salt: fromBase64(params.saltBase64),
        memoryKiB: params.memoryKiB,
        iterations: params.iterations,
        parallelism: params.parallelism,
        length: 32
      });
      assertXChaChaKey(key);
      return key;
    },

    async encrypt(
      plaintext: Uint8Array,
      key: Uint8Array,
      purpose: KeyPurpose,
      aad?: Uint8Array
    ): Promise<EncryptedPayload> {
      assertXChaChaKey(key);
      const nonce = provider.randomBytes(24);
      assertXChaChaNonce(nonce);
      const ciphertext = await provider.encryptXChaCha20Poly1305({
        plaintext,
        key,
        nonce,
        aad
      });
      return {
        profile: "local-vault-v1",
        algorithm: "xchacha20-poly1305",
        keyPurpose: purpose,
        nonceBase64: toBase64(nonce),
        ciphertextBase64: toBase64(ciphertext),
        aadBase64: aad ? toBase64(aad) : undefined
      };
    },

    async decrypt(payload: EncryptedPayload, key: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
      assertXChaChaKey(key);
      assertNativePayload(payload);
      return provider.decryptXChaCha20Poly1305({
        ciphertext: fromBase64(payload.ciphertextBase64),
        key,
        nonce: fromBase64(payload.nonceBase64),
        aad
      });
    },

    randomBytes(length: number): Uint8Array {
      if (length < 1) {
        throw new Error("Random byte length must be positive");
      }
      return provider.randomBytes(length);
    }
  };
}

function assertNativeKdfParams(params: KdfParams): void {
  if (params.algorithm !== "argon2id") {
    throw new Error(`Native crypto adapter requires argon2id KDF params, got ${params.algorithm}`);
  }
  if (params.memoryKiB < 1024) {
    throw new Error("Argon2id memoryKiB must be at least 1024");
  }
  if (params.iterations < 1) {
    throw new Error("Argon2id iterations must be positive");
  }
  if (params.parallelism < 1) {
    throw new Error("Argon2id parallelism must be positive");
  }
  if (!params.saltBase64.trim()) {
    throw new Error("Argon2id salt must not be empty");
  }
}

function assertNativePayload(payload: EncryptedPayload): void {
  if (payload.profile !== "local-vault-v1") {
    throw new Error(`Unsupported crypto profile: ${payload.profile}`);
  }
  if (payload.algorithm !== "xchacha20-poly1305") {
    throw new Error(`Unsupported native payload algorithm: ${payload.algorithm}`);
  }
  if (!payload.nonceBase64.trim()) {
    throw new Error("Encrypted payload nonce must not be empty");
  }
  assertXChaChaNonce(fromBase64(payload.nonceBase64));
  if (!payload.ciphertextBase64.trim()) {
    throw new Error("Encrypted payload ciphertext must not be empty");
  }
}

function assertXChaChaKey(key: Uint8Array): void {
  if (key.length !== 32) {
    throw new Error(`XChaCha20-Poly1305 key must be 32 bytes, got ${key.length}`);
  }
}

function assertXChaChaNonce(nonce: Uint8Array): void {
  if (nonce.length !== 24) {
    throw new Error(`XChaCha20-Poly1305 nonce must be 24 bytes, got ${nonce.length}`);
  }
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
