const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");
const desktopTransport = await import("../apps/desktop/src/local-network-transport.ts");
const mobileRuntime = await import("../apps/mobile/src/runtime.ts");
const mobileState = await import("../apps/mobile/src/runtime-state-storage.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T20:15:00.000Z";
const runtimeStateStorage = new mobileState.MobileMemoryRuntimeStateStorageAdapter();

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_mobile_state",
  name: "Desktop For Mobile State",
  kind: "desktop",
  publicKeyBase64: "desktop-mobile-state-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_mobile_state",
  name: "Phone Runtime State",
  kind: "phone",
  publicKeyBase64: "phone-mobile-state-key",
  now,
  ids
});

const pairingPort = 43188;
const desktopPairingPayload = sync.createPairingPayload({
  device: desktopDevice,
  localEndpoint: `http://127.0.0.1:${pairingPort}`,
  ttlSeconds: 300,
  now,
  ids
});
const desktopPairingQr = sync.encodePairingPayloadQr(desktopPairingPayload);

const desktopSession = new sync.NearFieldSyncSession({
  localDevice: desktopDevice
});

const phone = await mobileRuntime.createMobileRuntime({
  password: "mobile-runtime-state-password",
  vaultName: "Mobile Runtime State",
  localDevice: phoneDevice,
  runtimeStateStorage,
  kdfIterations: 20_000,
  now,
  ids
});

const server = await desktopTransport.startDesktopLocalNetworkEndpoint({
  session: desktopSession,
  pairingPayload: desktopPairingPayload,
  host: "127.0.0.1",
  port: pairingPort,
  now,
  ids
});

try {
  const pairing = await phone.scanPairingQrAndRequest(desktopPairingQr.payloadText, {
    localEndpoint: "http://127.0.0.1:43111",
    ttlSeconds: 300
  });
  if (pairing.scannedTarget.deviceName !== desktopDevice.name) {
    throw new Error("Expected mobile runtime to scan the desktop pairing target");
  }
  await phone.confirmPairingTrust(pairing.session, pairing.verification.sixDigitCode);

  const savedAfterPairing = await runtimeStateStorage.load();
  if (!savedAfterPairing?.trustedDevices.some((device) => device.id === desktopDevice.id)) {
    throw new Error("Expected mobile runtime state to persist trusted desktop device");
  }

  const draft = vault.createRecordDraft({
    type: "membership",
    title: "Mobile Reload Club",
    values: {
      member_name: "Mobile Reload Club",
      member_id: "MOBILE-RELOAD",
      expires_at: "2026-07-01T00:00:00.000Z"
    },
    reminderDrafts: [
      {
        dueAt: "2026-07-01T00:00:00.000Z",
        message: "Mobile Reload Club expires soon",
        daysBefore: 7
      }
    ]
  });

  phone.repository.insertRecord(vault.createVaultRecord({
    draft,
    encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
    now,
    ids
  }));

  const due = await phone.collectDueReminderNotifications("2026-06-24T00:00:00.000Z");
  if (due.length !== 1) {
    throw new Error("Expected mobile runtime to collect one reminder notification");
  }
  await phone.markReminderNotificationDelivered(due[0].alertId, "2026-06-24T00:01:00.000Z");

  const reloaded = await mobileRuntime.createMobileRuntime({
    password: "mobile-runtime-state-password",
    vaultName: "Mobile Runtime State",
    localDevice: phoneDevice,
    runtimeStateStorage,
    kdfIterations: 20_000,
    now,
    ids
  });

  if (reloaded.snapshot().trustedDevices !== 1) {
    throw new Error("Expected reloaded mobile runtime to restore trusted desktop device");
  }

  console.log("Mobile runtime-state smoke test passed.");
  console.log(
    JSON.stringify(
      {
        trustedDevices: reloaded.snapshot().trustedDevices,
        savedDeliveries: (await runtimeStateStorage.load()).reminderNotifications.deliveries.length,
        qrFormat: desktopPairingQr.format,
        pairingCode: pairing.verification.sixDigitCode
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
