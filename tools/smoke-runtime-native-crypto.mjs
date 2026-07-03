import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const crypto = await import("../packages/crypto-core/src/index.ts");
const desktopRuntime = await import("../apps/desktop/src/runtime.ts");
const mobileRuntime = await import("../apps/mobile/src/runtime.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-12T11:00:00.000Z";
const root = process.cwd();
const vaultPath = join(root, ".tmp", "runtime-native-crypto.vault-snapshot.json");
const restorePath = join(root, ".tmp", "runtime-native-crypto-restore.vault-snapshot.json");
await rm(vaultPath, { force: true });
await rm(`${vaultPath}.runtime-state.json`, { force: true });
await rm(restorePath, { force: true });
await rm(`${restorePath}.runtime-state.json`, { force: true });

const nativeAdapter = crypto.createNativeXChaCha20Poly1305Adapter({
  provider: createNodeBackedNativeProvider()
});
const nativeKdfParams = {
  ...crypto.DEFAULT_KDF_PARAMS,
  memoryKiB: 1024,
  iterations: 1
};

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_native_runtime",
  name: "Native Runtime Desktop",
  kind: "desktop",
  publicKeyBase64: "native-runtime-desktop-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_native_runtime",
  name: "Native Runtime Phone",
  kind: "phone",
  publicKeyBase64: "native-runtime-phone-key",
  now,
  ids
});

const desktop = await desktopRuntime.createDesktopRuntime({
  vaultPath,
  password: "native-runtime-password",
  vaultName: "Native Runtime Desktop Vault",
  localDevice: desktopDevice,
  cryptoAdapter: nativeAdapter,
  cryptoKdfParams: nativeKdfParams,
  now,
  ids
});

const desktopRecord = await desktop.addRecord({
  type: "secret_key",
  title: "Native Runtime API Key",
  values: {
    platform: "Native Runtime",
    key_id: "NATIVE-RUNTIME",
    secret: "native-runtime-secret"
  }
});

const desktopSecret = desktopRecord.fields.find((field) => field.key === "secret");
const desktopPayload = crypto.parseCryptoFieldCipher(desktopSecret.valueCipher);
if (desktopPayload.algorithm !== "xchacha20-poly1305") {
  throw new Error(`Expected desktop runtime field to use native crypto, got ${desktopPayload.algorithm}`);
}

const backupPackage = await desktop.exportEncryptedBackupPackage();
if (backupPackage.snapshotCipher.algorithm !== "xchacha20-poly1305") {
  throw new Error("Expected desktop encrypted backup package to use native crypto payloads");
}

const restoredDesktop = await desktopRuntime.restoreDesktopRuntimeFromEncryptedBackup({
  vaultPath: restorePath,
  password: "native-runtime-password",
  vaultName: "Native Runtime Restored Vault",
  localDevice: desktopDevice,
  packageJson: desktop.serializeEncryptedBackupPackage(backupPackage),
  cryptoAdapter: nativeAdapter,
  cryptoKdfParams: nativeKdfParams,
  saltBase64: desktop.cryptoState.kdfParams.saltBase64,
  now,
  ids
});

if (restoredDesktop.snapshot().records !== 1) {
  throw new Error("Expected native crypto desktop backup restore to recover one record");
}

const phone = await mobileRuntime.createMobileRuntime({
  password: "native-runtime-password",
  vaultName: "Native Runtime Phone Vault",
  localDevice: phoneDevice,
  cryptoAdapter: nativeAdapter,
  cryptoKdfParams: nativeKdfParams,
  now,
  ids
});

const capture = phone.startOcrCapture({
  source: "camera",
  image: {
    encryptedBlobPath: "attachments/native-runtime-member.blob",
    mimeType: "image/jpeg",
    digest: "sha256-native-runtime-member",
    encryptedSize: 2048,
    source: "camera"
  },
  rawText: `Native Runtime Club
Member ID NATIVE-2026
Expires 2026-12-31
Service phone 400-555-0199`
});

const phoneRecord = await phone.commitOcrCapture({
  capture,
  decision: {
    draftId: capture.ocrDraft.id,
    acceptedType: "membership",
    acceptedFieldKeys: ["member_name", "member_id", "expires_at", "service_phone"],
    rejectedFieldKeys: [],
    createReminder: true,
    decidedAt: now()
  }
});

const phoneMemberId = phoneRecord.fields.find((field) => field.key === "member_id");
const phonePayload = crypto.parseCryptoFieldCipher(phoneMemberId.valueCipher);
if (phonePayload.algorithm !== "xchacha20-poly1305") {
  throw new Error(`Expected mobile runtime field to use native crypto, got ${phonePayload.algorithm}`);
}

console.log("Runtime native crypto smoke test passed.");
console.log(
  JSON.stringify(
    {
      desktop: desktop.snapshot(),
      restoredDesktop: restoredDesktop.snapshot(),
      phone: phone.snapshot("2026-12-31T00:00:00.000Z"),
      desktopAlgorithm: desktopPayload.algorithm,
      phoneAlgorithm: phonePayload.algorithm,
      kdf: desktop.cryptoState.kdfParams.algorithm
    },
    null,
    2
  )
);

function createNodeBackedNativeProvider() {
  return {
    async deriveArgon2idKey(input) {
      return new Uint8Array(pbkdf2Sync(
        input.password,
        Buffer.from(input.salt),
        Math.max(input.iterations, 1) * 1000,
        input.length,
        "sha256"
      ));
    },

    async encryptXChaCha20Poly1305(input) {
      const cipher = createCipheriv("aes-256-gcm", Buffer.from(input.key), Buffer.from(input.nonce.slice(0, 12)));
      if (input.aad) {
        cipher.setAAD(Buffer.from(input.aad));
      }
      return new Uint8Array(Buffer.concat([
        cipher.update(Buffer.from(input.plaintext)),
        cipher.final(),
        cipher.getAuthTag()
      ]));
    },

    async decryptXChaCha20Poly1305(input) {
      const ciphertext = Buffer.from(input.ciphertext);
      const body = ciphertext.subarray(0, -16);
      const tag = ciphertext.subarray(-16);
      const decipher = createDecipheriv("aes-256-gcm", Buffer.from(input.key), Buffer.from(input.nonce.slice(0, 12)));
      if (input.aad) {
        decipher.setAAD(Buffer.from(input.aad));
      }
      decipher.setAuthTag(tag);
      return new Uint8Array(Buffer.concat([
        decipher.update(body),
        decipher.final()
      ]));
    },

    randomBytes(length) {
      return new Uint8Array(randomBytes(length));
    }
  };
}
