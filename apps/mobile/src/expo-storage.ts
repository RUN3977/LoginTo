import {
  parseVaultSnapshot,
  serializeVaultSnapshot,
  type VaultSnapshot,
  type VaultStorageAdapter
} from "../../../packages/vault-core/src/index.ts";
import {
  parseMobileRuntimeStateSnapshot,
  serializeMobileRuntimeStateSnapshot,
  type MobileRuntimeStateSnapshot,
  type MobileRuntimeStateStorageAdapter
} from "./runtime-state-storage.ts";

export interface ExpoFileInfo {
  exists: boolean;
  isDirectory?: boolean;
}

export interface ExpoFileSystemLike {
  documentDirectory?: string | null;
  cacheDirectory?: string | null;
  getInfoAsync(uri: string): Promise<ExpoFileInfo>;
  makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void>;
  readAsStringAsync(uri: string, options?: { encoding?: string }): Promise<string>;
  writeAsStringAsync(uri: string, contents: string, options?: { encoding?: string }): Promise<void>;
  deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void>;
  moveAsync(input: { from: string; to: string }): Promise<void>;
}

export interface ExpoSecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface ExpoStoragePaths {
  vaultUri: string;
  runtimeStateUri: string;
  tempVaultUri: string;
  tempRuntimeStateUri: string;
}

export class ExpoVaultStorageAdapter implements VaultStorageAdapter {
  readonly uri: string;
  readonly tempUri: string;
  #fileSystem: ExpoFileSystemLike;

  constructor(input: {
    fileSystem: ExpoFileSystemLike;
    uri: string;
    tempUri?: string;
  }) {
    this.#fileSystem = input.fileSystem;
    this.uri = input.uri;
    this.tempUri = input.tempUri ?? `${input.uri}.tmp`;
  }

  async exists(): Promise<boolean> {
    return (await this.#fileSystem.getInfoAsync(this.uri)).exists;
  }

  async load(): Promise<VaultSnapshot | undefined> {
    if (!(await this.exists())) {
      return undefined;
    }
    return parseVaultSnapshot(await this.#fileSystem.readAsStringAsync(this.uri, { encoding: "utf8" }));
  }

  async save(snapshot: VaultSnapshot): Promise<void> {
    await ensureDirectoryForUri(this.#fileSystem, this.uri);
    await this.#fileSystem.writeAsStringAsync(this.tempUri, serializeVaultSnapshot(snapshot), { encoding: "utf8" });
    await this.#fileSystem.moveAsync({ from: this.tempUri, to: this.uri });
  }

  async delete(): Promise<void> {
    await this.#fileSystem.deleteAsync(this.uri, { idempotent: true });
    await this.#fileSystem.deleteAsync(this.tempUri, { idempotent: true });
  }
}

export class ExpoRuntimeStateStorageAdapter implements MobileRuntimeStateStorageAdapter {
  readonly uri: string;
  readonly tempUri: string;
  #fileSystem: ExpoFileSystemLike;

  constructor(input: {
    fileSystem: ExpoFileSystemLike;
    uri: string;
    tempUri?: string;
  }) {
    this.#fileSystem = input.fileSystem;
    this.uri = input.uri;
    this.tempUri = input.tempUri ?? `${input.uri}.tmp`;
  }

  async exists(): Promise<boolean> {
    return (await this.#fileSystem.getInfoAsync(this.uri)).exists;
  }

  async load(): Promise<MobileRuntimeStateSnapshot | undefined> {
    if (!(await this.exists())) {
      return undefined;
    }
    return parseMobileRuntimeStateSnapshot(await this.#fileSystem.readAsStringAsync(this.uri, { encoding: "utf8" }));
  }

  async save(snapshot: MobileRuntimeStateSnapshot): Promise<void> {
    await ensureDirectoryForUri(this.#fileSystem, this.uri);
    await this.#fileSystem.writeAsStringAsync(this.tempUri, serializeMobileRuntimeStateSnapshot(snapshot), { encoding: "utf8" });
    await this.#fileSystem.moveAsync({ from: this.tempUri, to: this.uri });
  }

  async delete(): Promise<void> {
    await this.#fileSystem.deleteAsync(this.uri, { idempotent: true });
    await this.#fileSystem.deleteAsync(this.tempUri, { idempotent: true });
  }
}

export class ExpoSecureMetadataStore {
  readonly namespace: string;
  #secureStore: ExpoSecureStoreLike;

  constructor(input: {
    secureStore: ExpoSecureStoreLike;
    namespace?: string;
  }) {
    this.#secureStore = input.secureStore;
    this.namespace = input.namespace ?? "loginto";
  }

  async loadJson<T>(key: string): Promise<T | undefined> {
    const value = await this.#secureStore.getItemAsync(this.storageKey(key));
    return value ? JSON.parse(value) as T : undefined;
  }

  async saveJson(key: string, value: unknown): Promise<void> {
    await this.#secureStore.setItemAsync(this.storageKey(key), JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.#secureStore.deleteItemAsync(this.storageKey(key));
  }

  storageKey(key: string): string {
    if (!key.trim()) {
      throw new Error("Secure metadata key must not be empty");
    }
    return `${this.namespace}:${key}`;
  }
}

export function createExpoStoragePaths(input: {
  fileSystem: Pick<ExpoFileSystemLike, "documentDirectory">;
  vaultFileName?: string;
  runtimeStateFileName?: string;
}): ExpoStoragePaths {
  const root = normalizeDirectoryUri(input.fileSystem.documentDirectory ?? "");
  if (!root) {
    throw new Error("Expo file system documentDirectory is required for local vault storage");
  }
  const vaultUri = `${root}${input.vaultFileName ?? "loginto-vault-snapshot.json"}`;
  const runtimeStateUri = `${root}${input.runtimeStateFileName ?? "loginto-runtime-state.json"}`;
  return {
    vaultUri,
    runtimeStateUri,
    tempVaultUri: `${vaultUri}.tmp`,
    tempRuntimeStateUri: `${runtimeStateUri}.tmp`
  };
}

async function ensureDirectoryForUri(fileSystem: ExpoFileSystemLike, uri: string): Promise<void> {
  const directory = getDirectoryUri(uri);
  if (!directory) {
    return;
  }
  const info = await fileSystem.getInfoAsync(directory);
  if (!info.exists) {
    await fileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
}

function getDirectoryUri(uri: string): string | undefined {
  const normalized = uri.replace(/\/+$/, "");
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex <= 0) {
    return undefined;
  }
  return `${normalized.slice(0, slashIndex)}/`;
}

function normalizeDirectoryUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}
