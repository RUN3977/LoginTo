const sync = await import("../packages/sync-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T18:30:00.000Z";

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_bluetooth",
  name: "Bluetooth Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-bluetooth-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_bluetooth",
  name: "Bluetooth Phone",
  kind: "phone",
  publicKeyBase64: "phone-bluetooth-key",
  now,
  ids
});

const desktopSession = new sync.NearFieldSyncSession({
  localDevice: desktopDevice,
  trustedDevices: [phoneDevice]
});

const phoneSession = new sync.NearFieldSyncSession({
  localDevice: phoneDevice,
  trustedDevices: [desktopDevice],
  changes: [
    sync.createSyncChange({
      entity: "record",
      entityId: "record_bluetooth",
      operation: "create",
      deviceId: phoneDevice.id,
      lamport: 1,
      payloadCipher: "encrypted-bluetooth-record",
      createdAt: "2026-06-06T18:20:00.000Z",
      ids
    })
  ]
});

const exchangePackage = phoneSession.createOutgoingExchangePackage({
  receiverDeviceId: desktopDevice.id,
  sessionId: "bluetooth_session_smoke",
  confirmationId: "bluetooth_confirmation_smoke",
  now,
  ids
});
const cryptoAdapter = crypto.createWebCryptoAesGcmAdapter();
const cryptoKey = await cryptoAdapter.deriveKey("bluetooth-sync-envelope-secret", {
  ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  saltBase64: Buffer.from("bluetooth-sync-envelope-salt").toString("base64")
});
const encryptedPackage = await sync.encryptSyncExchangePackage({
  exchangePackage,
  adapter: cryptoAdapter,
  key: cryptoKey
});

const envelope = sync.createBluetoothSyncExchangeEnvelope({
  senderDevice: phoneDevice,
  receiverDevice: desktopDevice,
  encryptedPackage,
  now,
  ids
});

if (
  envelope.transport !== "bluetooth"
  || envelope.publicNetworkLogin !== false
  || envelope.requiresTrustedDevice !== true
  || JSON.stringify(envelope).includes("encrypted-bluetooth-record")
) {
  throw new Error("Expected Bluetooth envelope to carry only encrypted local-first sync data");
}

const parsedEnvelope = sync.parseBluetoothSyncExchangeEnvelope(sync.serializeBluetoothSyncExchangeEnvelope(envelope));
const decryptedPackage = await sync.decryptSyncExchangePackage({
  encryptedPackage: parsedEnvelope.encryptedPackage,
  adapter: cryptoAdapter,
  key: cryptoKey
});
const report = desktopSession.receiveExchangePackage({
  exchangePackage: decryptedPackage,
  transport: parsedEnvelope.transport,
  expectedSessionId: "bluetooth_session_smoke",
  expectedConfirmationId: "bluetooth_confirmation_smoke",
  now,
  ids
});

if (report.result.transport !== "bluetooth" || report.appliedChanges.length !== 1) {
  throw new Error("Expected Bluetooth envelope exchange to apply one encrypted change over bluetooth transport");
}

try {
  sync.parseBluetoothSyncExchangeEnvelope(JSON.stringify({
    ...parsedEnvelope,
    packageDigest: "tampered"
  }));
  throw new Error("Expected Bluetooth envelope digest tampering to be rejected");
} catch (error) {
  if (!String(error.message).includes("digest mismatch")) {
    throw error;
  }
}

try {
  sync.createBluetoothSyncExchangeEnvelope({
    senderDevice: desktopDevice,
    receiverDevice: phoneDevice,
    encryptedPackage,
    now,
    ids
  });
  throw new Error("Expected Bluetooth envelope sender mismatch to be rejected");
} catch (error) {
  if (!String(error.message).includes("sender")) {
    throw error;
  }
}

console.log("Bluetooth sync envelope smoke test passed.");
console.log(JSON.stringify({
  envelopeId: envelope.envelopeId,
  transport: envelope.transport,
  packageBytes: envelope.packageBytes,
  appliedChanges: report.appliedChanges.length,
  publicNetworkLogin: envelope.publicNetworkLogin
}, null, 2));
