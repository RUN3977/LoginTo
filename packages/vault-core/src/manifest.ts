import type { VaultManifest } from "./index";
import { VAULT_SCHEMA_VERSION } from "./constants.ts";
import { assertNonEmpty, defaultIdFactory, systemClock, type Clock, type IdFactory } from "./utils.ts";

export interface CreateVaultManifestInput {
  name: string;
  deviceId: string;
  vaultId?: string;
  cryptoProfile?: string;
  now?: Clock;
  ids?: IdFactory;
}

export function createVaultManifest(input: CreateVaultManifestInput): VaultManifest {
  assertNonEmpty(input.name, "Vault name");
  assertNonEmpty(input.deviceId, "Device id");

  const now = input.now ?? systemClock;
  const ids = input.ids ?? defaultIdFactory;
  const timestamp = now();

  return {
    vaultId: input.vaultId ?? ids.nextId("vault"),
    name: input.name.trim(),
    schemaVersion: VAULT_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    deviceId: input.deviceId,
    cryptoProfile: input.cryptoProfile ?? "local-vault-v1"
  };
}

export function touchVaultManifest(manifest: VaultManifest, now: Clock = systemClock): VaultManifest {
  return {
    ...manifest,
    updatedAt: now()
  };
}
