const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-05T18:00:00.000Z";

const desktop = sync.createDeviceIdentity({
  name: "Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-public-key",
  now,
  ids
});

const phone = sync.createDeviceIdentity({
  name: "Phone",
  kind: "phone",
  publicKeyBase64: "phone-public-key",
  now,
  ids
});

const desktopPayload = sync.createPairingPayload({
  device: desktop,
  localEndpoint: "http://192.168.1.2:43110",
  now,
  ids
});

const phonePayload = sync.createPairingPayload({
  device: phone,
  now,
  ids
});

const verification = sync.createPairingVerification(desktopPayload, phonePayload);
if (!verification.sixDigitCode.match(/^\d{6}$/)) {
  throw new Error(`Expected 6 digit pairing code, got ${verification.sixDigitCode}`);
}

if (sync.isPairingPayloadExpired(desktopPayload, "2026-06-05T18:10:01.000Z") !== true) {
  throw new Error("Expected pairing payload to be expired");
}

const changes = [
  sync.createSyncChange({
    entity: "record",
    entityId: "record_1",
    operation: "create",
    deviceId: desktop.id,
    lamport: 1,
    payloadCipher: "cipher-record",
    createdAt: now(),
    ids
  }),
  sync.createSyncChange({
    entity: "attachment",
    entityId: "attachment_1",
    operation: "create",
    deviceId: desktop.id,
    lamport: 2,
    payloadCipher: "cipher-attachment",
    createdAt: now(),
    ids
  })
];

const summary = sync.summarizeSyncChanges(changes, desktop.id);
if (summary.changeCount !== 2 || summary.attachmentCount !== 1 || summary.lastLamport !== 2) {
  throw new Error("Unexpected sync summary");
}

console.log("Sync core smoke test passed.");
console.log(
  JSON.stringify(
    {
      desktopDevice: desktop.id,
      phoneDevice: phone.id,
      pairingCode: verification.sixDigitCode,
      changes: summary.changeCount,
      attachments: summary.attachmentCount
    },
    null,
    2
  )
);
