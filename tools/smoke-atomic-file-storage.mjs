import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const vault = await import("../packages/vault-core/src/index.ts");
const desktopVaultStorage = await import("../apps/desktop/src/file-vault-storage.ts");
const mobileVaultStorage = await import("../apps/mobile/src/file-vault-storage.ts");
const desktopRuntimeState = await import("../apps/desktop/src/runtime-state-storage.ts");
const mobileRuntimeState = await import("../apps/mobile/src/runtime-state-storage.ts");

const root = process.cwd();
const tmp = join(root, ".tmp");
const files = {
  desktopVault: join(tmp, "atomic-storage-desktop.vault-snapshot.json"),
  mobileVault: join(tmp, "atomic-storage-mobile.vault-snapshot.json"),
  desktopState: join(tmp, "atomic-storage-desktop.runtime-state.json"),
  mobileState: join(tmp, "atomic-storage-mobile.runtime-state.json")
};
const now = () => "2026-07-01T16:00:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_atomic_${this.value}`;
  }
};

for (const file of Object.values(files)) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

const manifest = vault.createVaultManifest({
  name: "Atomic Storage Vault",
  deviceId: "device_atomic_storage",
  now,
  ids
});
const snapshot = vault.createVaultSnapshot(manifest, [], { now });

const desktopVault = new desktopVaultStorage.DesktopFileVaultStorageAdapter(files.desktopVault);
const mobileVault = new mobileVaultStorage.MobileFileVaultStorageAdapter(files.mobileVault);
await desktopVault.save(snapshot);
await mobileVault.save(snapshot);

const desktopState = new desktopRuntimeState.DesktopFileRuntimeStateStorageAdapter(files.desktopState);
const mobileState = new mobileRuntimeState.MobileFileRuntimeStateStorageAdapter(files.mobileState);
await desktopState.save(desktopRuntimeState.createDesktopRuntimeStateSnapshot({
  trustedDevices: [],
  updatedAt: now()
}));
await mobileState.save(mobileRuntimeState.createMobileRuntimeStateSnapshot({
  trustedDevices: [],
  updatedAt: now()
}));

for (const [label, file] of Object.entries(files)) {
  JSON.parse(await readFile(file, "utf8"));
  await assertNoTempFile(file, label);
}

const loadedDesktopVault = await desktopVault.load();
const loadedMobileVault = await mobileVault.load();
const loadedDesktopState = await desktopState.load();
const loadedMobileState = await mobileState.load();

if (!loadedDesktopVault || !loadedMobileVault || !loadedDesktopState || !loadedMobileState) {
  throw new Error("Expected all atomic storage adapters to load saved state");
}

console.log("Atomic file storage smoke test passed.");
console.log(JSON.stringify({
  desktopVaultRecords: loadedDesktopVault.records.length,
  mobileVaultRecords: loadedMobileVault.records.length,
  desktopRuntimeStateVersion: loadedDesktopState.runtimeStateVersion,
  mobileRuntimeStateVersion: loadedMobileState.runtimeStateVersion,
  tempFilesRemoved: true
}, null, 2));

async function assertNoTempFile(file, label) {
  try {
    await stat(`${file}.tmp`);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`Expected ${label} atomic temp file to be removed`);
}
