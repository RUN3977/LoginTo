import type {
  AsyncDecryptVaultPackagePayload,
  AsyncEncryptVaultPackagePayload,
  VaultCipherEnvelope
} from "@loginto/vault-core";
import type { CryptoAdapter } from "./index.ts";

export interface CreateCryptoPackageEncryptorInput {
  adapter: CryptoAdapter;
  key: Uint8Array;
}

export function createCryptoPackageEncryptor(input: CreateCryptoPackageEncryptorInput): AsyncEncryptVaultPackagePayload {
  return async (payload) => {
    assertPackageKeyPurpose(payload.keyPurpose);
    return input.adapter.encrypt(
      new TextEncoder().encode(payload.plaintext),
      input.key,
      payload.keyPurpose,
      new TextEncoder().encode(payload.aad)
    ) as Promise<VaultCipherEnvelope>;
  };
}

export function createCryptoPackageDecryptor(input: CreateCryptoPackageEncryptorInput): AsyncDecryptVaultPackagePayload {
  return async (payload) => {
    assertPackageKeyPurpose(payload.cipher.keyPurpose);
    const plaintext = await input.adapter.decrypt(
      payload.cipher,
      input.key,
      new TextEncoder().encode(payload.aad)
    );
    return new TextDecoder().decode(plaintext);
  };
}

function assertPackageKeyPurpose(keyPurpose: VaultCipherEnvelope["keyPurpose"]): void {
  if (keyPurpose !== "backup-package" && keyPurpose !== "sync-session") {
    throw new Error(`Unsupported package key purpose: ${keyPurpose}`);
  }
}
