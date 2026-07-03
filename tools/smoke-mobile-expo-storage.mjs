const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");
const sync = await import("../packages/sync-core/src/index.ts");
const mobileRuntime = await import("../apps/mobile/src/runtime.ts");
const expoStorage = await import("../apps/mobile/src/expo-storage.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-12T09:00:00.000Z";

class MemoryExpoFileSystem {
  #files = new Map();
  #directories = new Set();
  documentDirectory;

  constructor(documentDirectory) {
    this.documentDirectory = documentDirectory;
    this.#directories.add(documentDirectory);
  }

  get size() {
    return this.#files.size;
  }

  async getInfoAsync(uri) {
    return {
      exists: this.#files.has(uri) || this.#directories.has(uri),
      isDirectory: this.#directories.has(uri)
    };
  }

  async makeDirectoryAsync(uri) {
    this.#directories.add(uri.endsWith("/") ? uri : `${uri}/`);
  }

  async readAsStringAsync(uri) {
    if (!this.#files.has(uri)) {
      throw new Error(`Missing file: ${uri}`);
    }
    return this.#files.get(uri);
  }

  async writeAsStringAsync(uri, contents) {
    this.#files.set(uri, contents);
  }

  async deleteAsync(uri) {
    this.#files.delete(uri);
  }

  async moveAsync(input) {
    if (!this.#files.has(input.from)) {
      throw new Error(`Missing move source: ${input.from}`);
    }
    this.#files.set(input.to, this.#files.get(input.from));
    this.#files.delete(input.from);
  }
}

class MemoryExpoSecureStore {
  #items = new Map();

  get size() {
    return this.#items.size;
  }

  async getItemAsync(key) {
    return this.#items.get(key) ?? null;
  }

  async setItemAsync(key, value) {
    this.#items.set(key, value);
  }

  async deleteItemAsync(key) {
    this.#items.delete(key);
  }
}

const fileSystem = new MemoryExpoFileSystem("file:///documents/LoginTo/");
const secureStore = new MemoryExpoSecureStore();
const secureMetadata = new expoStorage.ExpoSecureMetadataStore({
  secureStore,
  namespace: "loginto-smoke"
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_expo_storage",
  name: "Expo Phone",
  kind: "phone",
  publicKeyBase64: "expo-phone-public-key",
  now,
  ids
});

const tabletDevice = sync.createDeviceIdentity({
  id: "device_tablet_expo_storage",
  name: "Expo Tablet",
  kind: "tablet",
  publicKeyBase64: "expo-tablet-public-key",
  now,
  ids
});

const trustedDesktop = sync.createDeviceIdentity({
  id: "device_desktop_expo_storage",
  name: "Expo Desktop",
  kind: "desktop",
  publicKeyBase64: "expo-desktop-public-key",
  now,
  ids
});

const phonePaths = expoStorage.createExpoStoragePaths({
  fileSystem,
  vaultFileName: "phone-vault.json",
  runtimeStateFileName: "phone-runtime.json"
});
const tabletPaths = expoStorage.createExpoStoragePaths({
  fileSystem,
  vaultFileName: "tablet-vault.json",
  runtimeStateFileName: "tablet-runtime.json"
});

await secureMetadata.saveJson("bootstrap", {
  vaultUri: phonePaths.vaultUri,
  runtimeStateUri: phonePaths.runtimeStateUri,
  deviceId: phoneDevice.id
});

const phoneVaultStorage = new expoStorage.ExpoVaultStorageAdapter({
  fileSystem,
  uri: phonePaths.vaultUri,
  tempUri: phonePaths.tempVaultUri
});
const phoneRuntimeStateStorage = new expoStorage.ExpoRuntimeStateStorageAdapter({
  fileSystem,
  uri: phonePaths.runtimeStateUri,
  tempUri: phonePaths.tempRuntimeStateUri
});

const phone = await mobileRuntime.createMobileRuntime({
  password: "expo-phone-password",
  vaultName: "Expo Phone Vault",
  localDevice: phoneDevice,
  vaultStorage: phoneVaultStorage,
  runtimeStateStorage: phoneRuntimeStateStorage,
  kdfIterations: 20_000,
  now,
  ids
});

phone.repository.insertRecord(vault.createVaultRecord({
  draft: vault.createRecordDraft({
    type: "membership",
    title: "Expo Storage Club",
    values: {
      member_name: "Expo Storage Club",
      member_id: "EXPO-2026",
      expires_at: "2026-08-01T00:00:00.000Z"
    },
    reminderDrafts: [
      {
        dueAt: "2026-08-01T00:00:00.000Z",
        message: "Expo Storage Club expires soon",
        daysBefore: 7
      }
    ]
  }),
  encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
  now,
  ids
}));
await phone.saveVaultState();
phone.syncSession.trustDevice(trustedDesktop, "2026-06-12T09:01:00.000Z");
await phone.saveRuntimeState("2026-06-12T09:02:00.000Z");

const reloadedPhone = await mobileRuntime.createMobileRuntime({
  password: "expo-phone-password",
  vaultName: "Expo Phone Vault",
  localDevice: phoneDevice,
  vaultStorage: phoneVaultStorage,
  runtimeStateStorage: phoneRuntimeStateStorage,
  kdfIterations: 20_000,
  now,
  ids
});

if (reloadedPhone.snapshot().records !== 1 || reloadedPhone.snapshot().trustedDevices !== 1) {
  throw new Error("Expected Expo-backed phone runtime to restore vault records and trusted devices");
}

const tabletVaultStorage = new expoStorage.ExpoVaultStorageAdapter({
  fileSystem,
  uri: tabletPaths.vaultUri,
  tempUri: tabletPaths.tempVaultUri
});
const tabletRuntimeStateStorage = new expoStorage.ExpoRuntimeStateStorageAdapter({
  fileSystem,
  uri: tabletPaths.runtimeStateUri,
  tempUri: tabletPaths.tempRuntimeStateUri
});

const tablet = await mobileRuntime.createMobileRuntime({
  password: "expo-tablet-password",
  vaultName: "Expo Tablet Vault",
  localDevice: tabletDevice,
  vaultStorage: tabletVaultStorage,
  runtimeStateStorage: tabletRuntimeStateStorage,
  kdfIterations: 20_000,
  now,
  ids
});
tablet.syncSession.trustDevice(trustedDesktop, "2026-06-12T09:03:00.000Z");
await tablet.saveRuntimeState("2026-06-12T09:04:00.000Z");

const reloadedTablet = await mobileRuntime.createMobileRuntime({
  password: "expo-tablet-password",
  vaultName: "Expo Tablet Vault",
  localDevice: tabletDevice,
  vaultStorage: tabletVaultStorage,
  runtimeStateStorage: tabletRuntimeStateStorage,
  kdfIterations: 20_000,
  now,
  ids
});

if (reloadedTablet.snapshot().trustedDevices !== 1) {
  throw new Error("Expected Expo-backed tablet runtime to restore trusted devices");
}

const bootstrap = await secureMetadata.loadJson("bootstrap");
if (bootstrap.deviceId !== phoneDevice.id || !bootstrap.vaultUri.endsWith("phone-vault.json")) {
  throw new Error("Expected Expo secure metadata store to round-trip JSON values");
}

if (await phoneVaultStorage.exists() !== true || await phoneRuntimeStateStorage.exists() !== true) {
  throw new Error("Expected Expo storage adapters to report persisted files");
}

console.log("Mobile Expo storage smoke test passed.");
console.log(
  JSON.stringify(
    {
      phone: reloadedPhone.snapshot(),
      tablet: reloadedTablet.snapshot(),
      vaultUri: phonePaths.vaultUri,
      runtimeStateUri: phonePaths.runtimeStateUri,
      secureKeys: secureStore.size,
      files: fileSystem.size
    },
    null,
    2
  )
);
