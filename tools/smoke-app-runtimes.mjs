import { rm } from "node:fs/promises";
import { join } from "node:path";

const desktopRuntime = await import("../apps/desktop/src/runtime.ts");
const mobileRuntime = await import("../apps/mobile/src/runtime.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const root = process.cwd();
const vaultPath = join(root, ".tmp", "runtime-smoke.vault-snapshot.json");
const now = () => "2026-06-06T18:35:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

await rm(vaultPath, { force: true });

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_runtime",
  name: "Runtime Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-runtime-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_runtime",
  name: "Runtime Phone",
  kind: "phone",
  publicKeyBase64: "phone-runtime-key",
  now,
  ids
});

const desktop = await desktopRuntime.createDesktopRuntime({
  vaultPath,
  password: "runtime-password",
  vaultName: "Runtime Desktop Vault",
  localDevice: desktopDevice,
  kdfIterations: 20_000,
  now,
  ids
});

const phone = await mobileRuntime.createMobileRuntime({
  password: "runtime-password",
  vaultName: "Runtime Phone Vault",
  localDevice: phoneDevice,
  kdfIterations: 20_000,
  now,
  ids
});

await desktop.addRecord({
  type: "membership",
  title: "Runtime Club",
  values: {
    member_name: "Runtime Club",
    member_id: "RUN-2026",
    expires_at: "2026-06-06T19:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-06-06T19:00:00.000Z",
      message: "Runtime Club 即将到期",
      daysBefore: 0
    }
  ]
});

const preparedCapture = await phone.prepareEncryptedCapture({
  plaintext: new TextEncoder().encode("runtime fake member card image bytes"),
  mimeType: "image/jpeg",
  source: "camera",
  aadPrefix: "runtime-smoke-attachment"
});

const capture = phone.startOcrCapture({
  source: "camera",
  imageAttachmentId: preparedCapture.imageAttachmentId,
  image: preparedCapture.image,
  rawText: `Runtime Gym
会员号 RUNTIME-2026
到期 2026-12-31
客服电话 400-555-0188`
});

const mobileRecord = await phone.commitOcrCapture({
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

const desktopPairing = desktop.beginPairing({
  localEndpoint: "http://127.0.0.1:43110",
  ttlSeconds: 300
});
const phonePairing = phone.beginPairing({
  localEndpoint: "http://127.0.0.1:43111",
  ttlSeconds: 300
});
const desktopVerification = desktopPairing.receiveRemotePayload(phonePairing.localPayload);
const phoneVerification = phonePairing.receiveRemotePayload(desktopPairing.localPayload);

if (desktopVerification.sixDigitCode !== phoneVerification.sixDigitCode) {
  throw new Error("Expected runtime pairing codes to match");
}

desktopPairing.markVerified("2026-06-06T18:36:00.000Z");
phonePairing.markVerified("2026-06-06T18:36:00.000Z");
desktopPairing.confirmTrustedDevice(desktop.syncSession.trustedDevices, "2026-06-06T18:37:00.000Z");
phonePairing.confirmTrustedDevice(phone.syncSession.trustedDevices, "2026-06-06T18:37:00.000Z");

phone.appendLocalSyncChange(sync.createSyncChange({
  id: "sync_change_runtime_mobile_record",
  entity: "record",
  entityId: mobileRecord.id,
  operation: "create",
  deviceId: phone.localDevice.id,
  lamport: 1,
  payloadCipher: "encrypted-runtime-mobile-record",
  createdAt: "2026-06-06T18:38:00.000Z",
  ids
}));

const server = await desktop.startLocalNetworkEndpoint({
  host: "127.0.0.1",
  port: 0
});

try {
  const exchange = phone.createOutgoingExchangePackage(desktop.localDevice.id);
  const response = await phone.sendExchangePackage(server.descriptor, exchange);

  if (!response.ok || response.body?.appliedChanges.length !== 1) {
    throw new Error("Expected runtime sync to apply one mobile change");
  }

  const desktopSnapshot = desktop.snapshot("2026-06-06T19:00:00.000Z");
  const phoneSnapshot = phone.snapshot("2026-12-31T00:00:00.000Z");

  if (desktopSnapshot.records !== 1 || desktopSnapshot.trustedDevices !== 1) {
    throw new Error("Expected desktop runtime snapshot to show one record and one trusted device");
  }

  if (phoneSnapshot.records !== 1 || phoneSnapshot.trustedDevices !== 1) {
    throw new Error("Expected mobile runtime snapshot to show one record and one trusted device");
  }

  console.log("App runtime smoke test passed.");
  console.log(
    JSON.stringify(
      {
        desktop: desktopSnapshot,
        phone: phoneSnapshot,
        pairingCode: desktopVerification.sixDigitCode,
        endpoint: server.baseUrl,
        appliedChanges: response.body.appliedChanges.length,
        mobileAttachmentSize: preparedCapture.image.encryptedSize
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
