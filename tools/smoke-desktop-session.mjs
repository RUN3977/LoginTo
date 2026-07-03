import { rm } from "node:fs/promises";
import { join } from "node:path";

const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");
const desktopStorage = await import("../apps/desktop/src/file-vault-storage.ts");
const desktopSession = await import("../apps/desktop/src/vault-session.ts");

const root = process.cwd();
const smokePath = join(root, ".tmp", "desktop-session-smoke.vault-snapshot.json");
const fixedNow = () => "2026-06-05T16:25:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

await rm(smokePath, { force: true });

const storage = new desktopStorage.DesktopFileVaultStorageAdapter(smokePath);
const session = await desktopSession.DesktopVaultSession.createNew({
  name: "Desktop Session Smoke",
  deviceId: "device_desktop_session",
  storage,
  encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
  now: fixedNow,
  ids
});

const tag = vault.createTag({
  name: "desktop",
  color: "#2563EB",
  ids
});
session.upsertTag(tag);

const record = session.addRecord({
  type: "account",
  title: "Desktop Login",
  values: {
    username: "desktop-user",
    password: "dev-only",
    url: "https://desktop.example"
  },
  tagIds: [tag.id]
});

session.updateRecordFields(record.id, [
  {
    key: "email",
    value: "desktop@example.test"
  }
]);

await session.save();

const loaded = await desktopSession.DesktopVaultSession.load({
  storage,
  encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
  now: fixedNow,
  ids,
  missing: "throw"
});

if (!loaded) {
  throw new Error("Expected loaded desktop session");
}

const searchResults = loaded.searchRecords("desktop");
if (searchResults.length !== 1) {
  throw new Error(`Expected 1 loaded search result, got ${searchResults.length}`);
}

const exported = loaded.exportPackage(crypto.createUnsafeDevelopmentPackageEncryptor());
if (exported.vaultId !== loaded.repository.getManifest().vaultId) {
  throw new Error("Exported package vault id mismatch");
}

await storage.delete();

console.log("Desktop vault session smoke test passed.");
console.log(
  JSON.stringify(
    {
      records: loaded.getRecords().length,
      tags: loaded.getTags().length,
      searchResults: searchResults.length,
      packageFormat: exported.format
    },
    null,
    2
  )
);
