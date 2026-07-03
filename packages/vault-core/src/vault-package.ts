import type { AttachmentRef } from "./index.ts";
import {
  assertVaultSnapshot,
  parseVaultSnapshot,
  serializeVaultSnapshot,
  type VaultSnapshot
} from "./storage.ts";
import { defaultIdFactory, isIsoDateTime, systemClock, type Clock, type IdFactory } from "./utils.ts";

export const VAULT_PACKAGE_FORMAT = "loginto-vault-package-v1";

export interface VaultCipherEnvelope {
  profile: string;
  algorithm: string;
  keyPurpose: "backup-package" | "sync-session";
  nonceBase64: string;
  ciphertextBase64: string;
  aadBase64?: string;
}

export interface VaultPackageAttachmentEntry {
  id: string;
  recordId: string;
  mimeType: string;
  digest: string;
  encryptedSize: number;
  sourcePath: string;
}

export interface VaultPackage {
  format: typeof VAULT_PACKAGE_FORMAT;
  packageId: string;
  vaultId: string;
  sourceDeviceId: string;
  createdAt: string;
  snapshotCipher: VaultCipherEnvelope;
  attachments: VaultPackageAttachmentEntry[];
}

export interface EncryptVaultPackagePayloadInput {
  plaintext: string;
  aad: string;
  keyPurpose: VaultCipherEnvelope["keyPurpose"];
}

export interface DecryptVaultPackagePayloadInput {
  cipher: VaultCipherEnvelope;
  aad: string;
}

export type EncryptVaultPackagePayload = (input: EncryptVaultPackagePayloadInput) => VaultCipherEnvelope;

export type DecryptVaultPackagePayload = (input: DecryptVaultPackagePayloadInput) => string;

export type AsyncEncryptVaultPackagePayload = (input: EncryptVaultPackagePayloadInput) => Promise<VaultCipherEnvelope>;

export type AsyncDecryptVaultPackagePayload = (input: DecryptVaultPackagePayloadInput) => Promise<string>;

export interface CreateVaultPackageInput {
  snapshot: VaultSnapshot;
  keyPurpose: VaultCipherEnvelope["keyPurpose"];
  encryptPayload: EncryptVaultPackagePayload;
  packageId?: string;
  now?: Clock;
  ids?: IdFactory;
}

export interface CreateVaultPackageAsyncInput extends Omit<CreateVaultPackageInput, "encryptPayload"> {
  encryptPayload: AsyncEncryptVaultPackagePayload;
}

export function createVaultPackage(input: CreateVaultPackageInput): VaultPackage {
  assertVaultSnapshot(input.snapshot);

  const ids = input.ids ?? defaultIdFactory;
  const now = input.now ?? systemClock;
  const createdAt = now();
  const packageId = input.packageId ?? ids.nextId("vault_package");
  const aad = createVaultPackageAad({
    packageId,
    vaultId: input.snapshot.manifest.vaultId,
    sourceDeviceId: input.snapshot.manifest.deviceId,
    createdAt
  });

  const snapshotCipher = input.encryptPayload({
    plaintext: serializeVaultSnapshot(input.snapshot),
    aad,
    keyPurpose: input.keyPurpose
  });

  const vaultPackage: VaultPackage = {
    format: VAULT_PACKAGE_FORMAT,
    packageId,
    vaultId: input.snapshot.manifest.vaultId,
    sourceDeviceId: input.snapshot.manifest.deviceId,
    createdAt,
    snapshotCipher,
    attachments: collectPackageAttachments(input.snapshot)
  };

  assertVaultPackage(vaultPackage);
  return vaultPackage;
}

export async function createVaultPackageAsync(input: CreateVaultPackageAsyncInput): Promise<VaultPackage> {
  assertVaultSnapshot(input.snapshot);

  const ids = input.ids ?? defaultIdFactory;
  const now = input.now ?? systemClock;
  const createdAt = now();
  const packageId = input.packageId ?? ids.nextId("vault_package");
  const aad = createVaultPackageAad({
    packageId,
    vaultId: input.snapshot.manifest.vaultId,
    sourceDeviceId: input.snapshot.manifest.deviceId,
    createdAt
  });

  const snapshotCipher = await input.encryptPayload({
    plaintext: serializeVaultSnapshot(input.snapshot),
    aad,
    keyPurpose: input.keyPurpose
  });

  const vaultPackage: VaultPackage = {
    format: VAULT_PACKAGE_FORMAT,
    packageId,
    vaultId: input.snapshot.manifest.vaultId,
    sourceDeviceId: input.snapshot.manifest.deviceId,
    createdAt,
    snapshotCipher,
    attachments: collectPackageAttachments(input.snapshot)
  };

  assertVaultPackage(vaultPackage);
  return vaultPackage;
}

export function restoreSnapshotFromVaultPackage(
  vaultPackage: VaultPackage,
  decryptPayload: DecryptVaultPackagePayload
): VaultSnapshot {
  assertVaultPackage(vaultPackage);
  const aad = createVaultPackageAad({
    packageId: vaultPackage.packageId,
    vaultId: vaultPackage.vaultId,
    sourceDeviceId: vaultPackage.sourceDeviceId,
    createdAt: vaultPackage.createdAt
  });
  const plaintext = decryptPayload({
    cipher: vaultPackage.snapshotCipher,
    aad
  });
  return parseVaultSnapshot(plaintext);
}

export async function restoreSnapshotFromVaultPackageAsync(
  vaultPackage: VaultPackage,
  decryptPayload: AsyncDecryptVaultPackagePayload
): Promise<VaultSnapshot> {
  assertVaultPackage(vaultPackage);
  const aad = createVaultPackageAad({
    packageId: vaultPackage.packageId,
    vaultId: vaultPackage.vaultId,
    sourceDeviceId: vaultPackage.sourceDeviceId,
    createdAt: vaultPackage.createdAt
  });
  const plaintext = await decryptPayload({
    cipher: vaultPackage.snapshotCipher,
    aad
  });
  return parseVaultSnapshot(plaintext);
}

export function serializeVaultPackage(vaultPackage: VaultPackage): string {
  assertVaultPackage(vaultPackage);
  return JSON.stringify(vaultPackage, null, 2);
}

export function parseVaultPackage(json: string): VaultPackage {
  const parsed = JSON.parse(json) as VaultPackage;
  assertVaultPackage(parsed);
  return parsed;
}

export function assertVaultPackage(vaultPackage: VaultPackage): void {
  if (vaultPackage.format !== VAULT_PACKAGE_FORMAT) {
    throw new Error(`Unsupported vault package format: ${vaultPackage.format}`);
  }

  if (!vaultPackage.packageId.trim()) {
    throw new Error("Vault package id must not be empty");
  }

  if (!vaultPackage.vaultId.trim()) {
    throw new Error("Vault package vault id must not be empty");
  }

  if (!vaultPackage.sourceDeviceId.trim()) {
    throw new Error("Vault package source device id must not be empty");
  }

  if (!isIsoDateTime(vaultPackage.createdAt)) {
    throw new Error("Vault package createdAt must be an ISO date-time string");
  }

  if (vaultPackage.snapshotCipher.keyPurpose !== "backup-package" && vaultPackage.snapshotCipher.keyPurpose !== "sync-session") {
    throw new Error(`Unsupported package cipher purpose: ${vaultPackage.snapshotCipher.keyPurpose}`);
  }

  const attachmentIds = new Set<string>();
  for (const attachment of vaultPackage.attachments) {
    if (attachmentIds.has(attachment.id)) {
      throw new Error(`Duplicate package attachment id: ${attachment.id}`);
    }
    attachmentIds.add(attachment.id);
    if (!attachment.recordId.trim()) {
      throw new Error(`Package attachment ${attachment.id} has no record id`);
    }
  }
}

export function createVaultPackageAad(input: {
  packageId: string;
  vaultId: string;
  sourceDeviceId: string;
  createdAt: string;
}): string {
  return JSON.stringify({
    format: VAULT_PACKAGE_FORMAT,
    packageId: input.packageId,
    vaultId: input.vaultId,
    sourceDeviceId: input.sourceDeviceId,
    createdAt: input.createdAt
  });
}

function collectPackageAttachments(snapshot: VaultSnapshot): VaultPackageAttachmentEntry[] {
  return snapshot.records
    .flatMap((record) =>
      record.attachments.map((attachment: AttachmentRef) => ({
        id: attachment.id,
        recordId: attachment.recordId,
        mimeType: attachment.mimeType,
        digest: attachment.digest,
        encryptedSize: attachment.encryptedSize,
        sourcePath: attachment.encryptedBlobPath
      }))
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}
