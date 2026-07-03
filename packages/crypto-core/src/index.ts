export type CryptoProfile = "local-vault-v1";

export type KdfAlgorithm = "argon2id" | "pbkdf2-sha256";

export type CipherAlgorithm = "xchacha20-poly1305" | "aes-256-gcm";

export type KeyPurpose =
  | "vault-content"
  | "attachment-content"
  | "sync-session"
  | "backup-package";

export interface KdfParams {
  algorithm: KdfAlgorithm;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  saltBase64: string;
}

export interface EncryptedPayload {
  profile: CryptoProfile;
  algorithm: CipherAlgorithm;
  keyPurpose: KeyPurpose;
  nonceBase64: string;
  ciphertextBase64: string;
  aadBase64?: string;
}

export interface VaultKeyEnvelope {
  profile: CryptoProfile;
  kdf: KdfParams;
  wrappedKey: EncryptedPayload;
  createdAt: string;
}

export interface CryptoAdapter {
  readonly profile: CryptoProfile;
  deriveKey(password: string, params: KdfParams): Promise<Uint8Array>;
  encrypt(plaintext: Uint8Array, key: Uint8Array, purpose: KeyPurpose, aad?: Uint8Array): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload, key: Uint8Array, aad?: Uint8Array): Promise<Uint8Array>;
  randomBytes(length: number): Uint8Array;
}

export const DEFAULT_CRYPTO_PROFILE: CryptoProfile = "local-vault-v1";

export const DEFAULT_KDF_PARAMS: Omit<KdfParams, "saltBase64"> = {
  algorithm: "argon2id",
  memoryKiB: 19456,
  iterations: 2,
  parallelism: 1
};

export const DEFAULT_WEB_CRYPTO_KDF_PARAMS: Omit<KdfParams, "saltBase64"> = {
  algorithm: "pbkdf2-sha256",
  memoryKiB: 0,
  iterations: 600_000,
  parallelism: 1
};

export {
  ATTACHMENT_CIPHER_FORMAT,
  assertEncryptedAttachmentBlob,
  createAttachmentCipherAad,
  decryptAttachmentBlob,
  encryptAttachmentBlob,
  parseEncryptedAttachmentBlob,
  serializeEncryptedAttachmentBlob
} from "./attachment-encryption.ts";
export {
  createUnsafeDevelopmentFieldEncryptor,
  createUnsafeDevelopmentPackageDecryptor,
  createUnsafeDevelopmentPackageEncryptor
} from "./development.ts";
export { assertCryptoAdapterConformance } from "./conformance.ts";
export { FIELD_SECURITY_POLICY, SENSITIVE_COPY_CLEAR_SECONDS } from "./security-policy.ts";
export { VaultSecuritySession } from "./vault-security.ts";
export { createWebCryptoAesGcmAdapter } from "./webcrypto.ts";
export { createNativeXChaCha20Poly1305Adapter } from "./native.ts";
export {
  FIELD_CIPHER_FORMAT,
  createCryptoFieldAad,
  createCryptoFieldEncryptor,
  decryptCryptoFieldValue,
  parseCryptoFieldCipher
} from "./field-encryption.ts";
export {
  createCryptoPackageDecryptor,
  createCryptoPackageEncryptor
} from "./package-encryption.ts";
export type {
  AttachmentBlobSource,
  AttachmentCipherAadInput,
  DecryptAttachmentBlobInput,
  EncryptedAttachmentBlob,
  EncryptAttachmentBlobInput
} from "./attachment-encryption.ts";
export type {
  CryptoAdapterConformanceOptions,
  CryptoAdapterConformanceResult
} from "./conformance.ts";
export type {
  ClipboardClearPlan,
  FieldRevealDecision,
  VaultLockState,
  VaultSecuritySessionOptions,
  VaultSecuritySnapshot
} from "./vault-security.ts";
export type {
  CreateCryptoFieldEncryptorInput,
  DecryptCryptoFieldValueInput
} from "./field-encryption.ts";
export type { CreateCryptoPackageEncryptorInput } from "./package-encryption.ts";
export type {
  DevelopmentFieldEncryptInput,
  DevelopmentFieldEncryptor,
  DevelopmentPackageDecryptInput,
  DevelopmentPackageDecryptor,
  DevelopmentPackageEncryptInput,
  DevelopmentPackageEncryptor
} from "./development.ts";
export type { WebCryptoAdapterOptions } from "./webcrypto.ts";
export type {
  NativeArgon2idDeriveKeyInput,
  NativeCryptoAdapterOptions,
  NativeCryptoProvider,
  NativeXChaCha20Poly1305DecryptInput,
  NativeXChaCha20Poly1305EncryptInput
} from "./native.ts";
