import type { AsyncEncryptFieldValue, EncryptFieldValueInput, FieldSensitivity } from "@loginto/vault-core";
import type { CryptoAdapter, EncryptedPayload } from "./index.ts";

export const FIELD_CIPHER_FORMAT = "loginto-field-cipher-v1";

export interface CreateCryptoFieldEncryptorInput {
  adapter: CryptoAdapter;
  key: Uint8Array;
  aadPrefix?: string;
}

export interface DecryptCryptoFieldValueInput {
  adapter: CryptoAdapter;
  key: Uint8Array;
  recordId: string;
  fieldKey: string;
  sensitivity: FieldSensitivity;
  valueCipher: string;
  aadPrefix?: string;
}

export function createCryptoFieldEncryptor(input: CreateCryptoFieldEncryptorInput): AsyncEncryptFieldValue {
  return async (field) => {
    const payload = await input.adapter.encrypt(
      new TextEncoder().encode(field.value),
      input.key,
      "vault-content",
      createCryptoFieldAad(field, input.aadPrefix)
    );
    return `${FIELD_CIPHER_FORMAT}:${toBase64Utf8(JSON.stringify(payload))}`;
  };
}

export async function decryptCryptoFieldValue(input: DecryptCryptoFieldValueInput): Promise<string> {
  const payload = parseCryptoFieldCipher(input.valueCipher);
  const plaintext = await input.adapter.decrypt(
    payload,
    input.key,
    createCryptoFieldAad(
      {
        recordId: input.recordId,
        key: input.fieldKey,
        value: "",
        sensitivity: input.sensitivity
      },
      input.aadPrefix
    )
  );
  return new TextDecoder().decode(plaintext);
}

export function parseCryptoFieldCipher(valueCipher: string): EncryptedPayload {
  const [format, encoded] = valueCipher.split(":", 2);
  if (format !== FIELD_CIPHER_FORMAT || !encoded) {
    throw new Error(`Unsupported field cipher format: ${format}`);
  }
  return JSON.parse(fromBase64Utf8(encoded)) as EncryptedPayload;
}

export function createCryptoFieldAad(field: EncryptFieldValueInput, aadPrefix = "loginto-field"): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      scope: aadPrefix,
      recordId: field.recordId,
      fieldKey: field.key,
      sensitivity: field.sensitivity
    })
  );
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
