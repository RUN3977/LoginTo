import type { FieldSensitivity } from "@loginto/vault-core";

export interface DevelopmentFieldEncryptInput {
  recordId: string;
  key: string;
  value: string;
  sensitivity: FieldSensitivity;
}

export type DevelopmentFieldEncryptor = (input: DevelopmentFieldEncryptInput) => string;

export interface DevelopmentPackageEncryptInput {
  plaintext: string;
  aad: string;
  keyPurpose: "backup-package" | "sync-session";
}

export interface DevelopmentPackageDecryptInput {
  cipher: {
    profile: string;
    algorithm: string;
    keyPurpose: "backup-package" | "sync-session";
    nonceBase64: string;
    ciphertextBase64: string;
    aadBase64?: string;
  };
  aad: string;
}

export type DevelopmentPackageEncryptor = (input: DevelopmentPackageEncryptInput) => DevelopmentPackageDecryptInput["cipher"];

export type DevelopmentPackageDecryptor = (input: DevelopmentPackageDecryptInput) => string;

export function createUnsafeDevelopmentFieldEncryptor(): DevelopmentFieldEncryptor {
  return (input) => {
    const payload = JSON.stringify({
      recordId: input.recordId,
      key: input.key,
      value: input.value,
      sensitivity: input.sensitivity
    });
    const encoded = toBase64Utf8(payload);
    return `unsafe-dev-plain-v1:${encoded}`;
  };
}

export function createUnsafeDevelopmentPackageEncryptor(): DevelopmentPackageEncryptor {
  return (input) => ({
    profile: "unsafe-dev-package-v1",
    algorithm: "none-base64-json",
    keyPurpose: input.keyPurpose,
    nonceBase64: "",
    ciphertextBase64: toBase64Utf8(
      JSON.stringify({
        plaintext: input.plaintext,
        aad: input.aad
      })
    ),
    aadBase64: toBase64Utf8(input.aad)
  });
}

export function createUnsafeDevelopmentPackageDecryptor(): DevelopmentPackageDecryptor {
  return (input) => {
    if (input.cipher.profile !== "unsafe-dev-package-v1") {
      throw new Error(`Unsupported development package profile: ${input.cipher.profile}`);
    }
    const decoded = JSON.parse(fromBase64Utf8(input.cipher.ciphertextBase64)) as {
      plaintext: string;
      aad: string;
    };
    if (decoded.aad !== input.aad) {
      throw new Error("Development package AAD mismatch");
    }
    return decoded.plaintext;
  };
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function fromBase64Utf8(value: string): string {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}
