import { rm } from "node:fs/promises";
import { join } from "node:path";

const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");
const desktop = await import("../apps/desktop/src/file-vault-storage.ts");

const root = process.cwd();
const smokeDir = join(root, ".tmp");
const smokePath = join(smokeDir, "desktop-smoke.vault-snapshot.json");
const fixedNow = () => "2026-06-05T16:10:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

await rm(smokePath, { force: true });

const manifest = vault.createVaultManifest({
  name: "Desktop Smoke Vault",
  deviceId: "device_desktop_smoke",
  now: fixedNow,
  ids
});

const draft = vault.createRecordDraft({
  type: "account",
  title: "Example Account",
  values: {
    username: "tester",
    password: "not-for-real-use",
    url: "https://example.test"
  }
});

const record = vault.createVaultRecord({
  draft,
  encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
  now: fixedNow,
  ids
});

const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);
repository.insertRecord(record);

const storage = new desktop.DesktopFileVaultStorageAdapter(smokePath);
await repository.saveToStorage(storage);

if (!(await storage.exists())) {
  throw new Error("Expected desktop file storage to exist");
}

const restored = await vault.InMemoryVaultRepository.loadFromStorage(storage, fixedNow);
if (!restored) {
  throw new Error("Expected restored desktop repository");
}

const restoredRecords = restored.listRecords();
if (restoredRecords.length !== 1) {
  throw new Error(`Expected 1 restored record, got ${restoredRecords.length}`);
}

await storage.delete();

console.log("Desktop file storage smoke test passed.");
console.log(
  JSON.stringify(
    {
      path: smokePath,
      restoredRecords: restoredRecords.length,
      deletedAfterSmoke: !(await storage.exists())
    },
    null,
    2
  )
);
