const sync = await import("../packages/sync-core/src/index.ts");
const desktopEndpoint = await import("../apps/desktop/src/near-field-endpoint.ts");
const mobileEndpoint = await import("../apps/mobile/src/near-field-endpoint.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T12:35:00.000Z";

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

const desktopSession = new sync.NearFieldSyncSession({
  localDevice: desktopDevice,
  trustedDevices: [phoneDevice]
});

const phoneChange = sync.createSyncChange({
  id: "sync_change_phone_membership",
  entity: "record",
  entityId: "record_membership",
  operation: "create",
  deviceId: phoneDevice.id,
  lamport: 1,
  payloadCipher: "encrypted-membership-record",
  createdAt: "2026-06-06T12:30:00.000Z",
  ids
});

const phoneSession = new sync.NearFieldSyncSession({
  localDevice: phoneDevice,
  trustedDevices: [desktopDevice],
  changes: [phoneChange]
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

const desktopNearField = desktopEndpoint.createDesktopNearFieldEndpoint({
  session: desktopSession,
  baseUrl: "http://192.168.1.2:43110/",
  pairingPayload: desktopPairingPayload,
  now,
  ids
});

const phoneNearField = mobileEndpoint.createMobileNearFieldEndpoint({
  session: phoneSession,
  baseUrl: "http://192.168.1.3:43110/",
  pairingPayload: phonePairingPayload,
  now,
  ids
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
const pairingResponse = desktopNearField.handleRequest(pairingRequest);

if (!pairingResponse.ok || pairingResponse.body.localPairingPayload.device.id !== desktopDevice.id) {
  throw new Error("Expected desktop endpoint to return its pairing payload");
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
    transport: "hotspot"
  },
  now,
  ids
});
const exchangeResponse = desktopNearField.handleRequest(exchangeRequest);

if (!exchangeResponse.ok || exchangeResponse.body.result.transport !== "hotspot") {
  throw new Error("Expected desktop endpoint to apply hotspot exchange");
}

const desktopSummaryRequest = sync.createNearFieldRequest({
  route: "/sync/summary",
  senderDeviceId: desktopDevice.id,
  body: {
    remoteSummary: desktopSession.getLocalSummary()
  },
  now,
  ids
});
const phoneSummaryResponse = phoneNearField.handleRequest(desktopSummaryRequest);

if (!phoneSummaryResponse.ok || phoneSummaryResponse.body.deviceId !== phoneDevice.id) {
  throw new Error("Expected mobile endpoint to return phone summary");
}

if (desktopNearField.descriptor.routes["/sync/exchange"] !== "http://192.168.1.2:43110/sync/exchange") {
  throw new Error("Expected desktop endpoint descriptor to normalize base URL");
}

console.log("App near-field endpoint smoke test passed.");
console.log(
  JSON.stringify(
    {
      desktopEndpoint: desktopNearField.descriptor.baseUrl,
      phoneEndpoint: phoneNearField.descriptor.baseUrl,
      appliedChanges: exchangeResponse.body.appliedChanges.length,
      phoneSummaryChanges: phoneSummaryResponse.body.changeCount
    },
    null,
    2
  )
);
