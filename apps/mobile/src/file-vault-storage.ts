import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  parseVaultSnapshot,
  serializeVaultSnapshot,
  type VaultSnapshot,
  type VaultStorageAdapter
} from "../../../packages/vault-core/src/index.ts";

export class MobileFileVaultStorageAdapter implements VaultStorageAdapter {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  async exists(): Promise<boolean> {
    try {
      await readFile(this.path);
      return true;
    } catch (error) {
      if (isMissingFileError(error)) {
        return false;
      }
      throw error;
    }
  }

  async load(): Promise<VaultSnapshot | undefined> {
    try {
      const json = await readFile(this.path, "utf8");
      return parseVaultSnapshot(json);
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async save(snapshot: VaultSnapshot): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.tmp`;
    try {
      await writeFile(tempPath, serializeVaultSnapshot(snapshot), "utf8");
      parseVaultSnapshot(await readFile(tempPath, "utf8"));
      await rename(tempPath, this.path);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  async delete(): Promise<void> {
    await rm(this.path, { force: true });
    await rm(`${this.path}.tmp`, { force: true });
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
