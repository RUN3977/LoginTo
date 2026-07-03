const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T12:10:00.000Z";

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop",
  name: "Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone",
  name: "Phone",
  kind: "phone",
  publicKeyBase64: "phone-key",
  now,
  ids
});

const unknownDevice = sync.createDeviceIdentity({
  id: "device_unknown",
  name: "Unknown",
  kind: "tablet",
  publicKeyBase64: "unknown-key",
  now,
  ids
});

const desktopPairingPayload = sync.createPairingPayload({
  device: desktopDevice,
  sessionId: "pairing_desktop",
  localEndpoint: "http://192.168.1.2:43110",
  now,
  ids
});

const phonePairingPayload = sync.createPairingPayload({
  device: phoneDevice,
  sessionId: "pairing_phone",
  localEndpoint: "http://192.168.1.3:43110",
  now,
  ids
});

const desktopSession = new sync.NearFieldSyncSession({
  localDevice: desktopDevice
});
desktopSession.trustDevice(phoneDevice, now());

const phoneChange = sync.createSyncChange({
  id: "sync_change_phone_tag",
  entity: "tag",
  entityId: "tag_travel",
  operation: "create",
  deviceId: phoneDevice.id,
  lamport: 1,
  payloadCipher: "encrypted-phone-tag",
  createdAt: "2026-06-06T12:00:00.000Z",
  ids
});

const phoneSession = new sync.NearFieldSyncSession({
  localDevice: phoneDevice,
  trustedDevices: [desktopDevice],
  changes: [phoneChange]
});

const pairingRequest = sync.createNearFieldRequest({
  route: "/pairing",
  senderDeviceId: phoneDevice.id,
  body: {
    pairingPayload: phonePairingPayload
  },
  now,
  ids
});

const pairingResponse = sync.handleNearFieldRequest({
  session: desktopSession,
  request: pairingRequest,
  pairingPayload: desktopPairingPayload,
  now,
  ids
});

if (!pairingResponse.ok || pairingResponse.body.verification.sixDigitCode.length !== 6) {
  throw new Error("Expected pairing response with six-digit verification");
}

const summaryRequest = sync.createNearFieldRequest({
  route: "/sync/summary",
  senderDeviceId: phoneDevice.id,
  body: {
    remoteSummary: phoneSession.getLocalSummary()
  },
  now,
  ids
});

const summaryResponse = sync.handleNearFieldRequest({
  session: desktopSession,
  request: summaryRequest,
  now,
  ids
});

if (!summaryResponse.ok || summaryResponse.body.deviceId !== desktopDevice.id) {
  throw new Error("Expected trusted summary response for desktop device");
}

const exchangePackage = phoneSession.createOutgoingExchangePackage({
  receiverDeviceId: desktopDevice.id,
  now,
  ids
});

const exchangeRequest = sync.createNearFieldRequest({
  route: "/sync/exchange",
  senderDeviceId: phoneDevice.id,
  body: {
    exchangePackage,
    transport: "local-network"
  },
  now,
  ids
});

const exchangeResponse = sync.handleNearFieldRequest({
  session: desktopSession,
  request: exchangeRequest,
  now,
  ids
});

if (!exchangeResponse.ok || exchangeResponse.body.appliedChanges.length !== 1) {
  throw new Error("Expected one sync change to be applied through the handler");
}

if (desktopSession.changeLog.list().length !== 1) {
  throw new Error(`Expected desktop change log length 1, got ${desktopSession.changeLog.list().length}`);
}

const untrustedSummaryRequest = sync.createNearFieldRequest({
  route: "/sync/summary",
  senderDeviceId: unknownDevice.id,
  body: {},
  now,
  ids
});

const untrustedSummaryResponse = sync.handleNearFieldRequest({
  session: desktopSession,
  request: untrustedSummaryRequest,
  now,
  ids
});

if (untrustedSummaryResponse.ok || untrustedSummaryResponse.error?.code !== "not-trusted") {
  throw new Error("Expected untrusted device to be rejected");
}

console.log("Near-field handler smoke test passed.");
console.log(
  JSON.stringify(
    {
      pairingCode: pairingResponse.body.verification.sixDigitCode,
      summaryDeviceId: summaryResponse.body.deviceId,
      appliedChanges: exchangeResponse.body.appliedChanges.length,
      untrustedError: untrustedSummaryResponse.error.code
    },
    null,
    2
  )
);
