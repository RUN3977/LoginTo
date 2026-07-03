const sync = await import("../packages/sync-core/src/index.ts");
const desktopEndpoint = await import("../apps/desktop/src/near-field-endpoint.ts");
const desktopNetwork = await import("../apps/desktop/src/local-network-transport.ts");
const mobileNetwork = await import("../apps/mobile/src/local-network-transport.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T15:20:00.000Z";

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
  id: "sync_change_phone_record",
  entity: "record",
  entityId: "record_phone",
  operation: "create",
  deviceId: phoneDevice.id,
  lamport: 1,
  payloadCipher: "encrypted-phone-record",
  createdAt: "2026-06-06T15:10:00.000Z",
  ids
});

const phoneSession = new sync.NearFieldSyncSession({
  localDevice: phoneDevice,
  trustedDevices: [desktopDevice],
  changes: [phoneChange]
});

const desktopNearField = desktopEndpoint.createDesktopNearFieldEndpoint({
  session: desktopSession,
  baseUrl: "http://192.168.1.2:43110",
  now,
  ids
});

const transport = new sync.InMemoryNearFieldTransportAdapter();
transport.registerEndpoint(desktopNearField.descriptor, desktopNearField.handleRequest);

const summaryResponse = await sync.sendNearFieldRequest({
  transport,
  descriptor: desktopNearField.descriptor,
  route: "/sync/summary",
  senderDeviceId: phoneDevice.id,
  body: {
    remoteSummary: phoneSession.getLocalSummary()
  },
  now,
  ids
});

if (!summaryResponse.ok || summaryResponse.body.deviceId !== desktopDevice.id) {
  throw new Error("Expected transport summary response from desktop");
}

const exchangePackage = phoneSession.createOutgoingExchangePackage({
  receiverDeviceId: desktopDevice.id,
  now,
  ids
});

const exchangeResponse = await sync.sendNearFieldRequest({
  transport,
  descriptor: desktopNearField.descriptor,
  route: "/sync/exchange",
  senderDeviceId: phoneDevice.id,
  body: {
    exchangePackage,
    transport: "local-network"
  },
  now,
  ids
});

if (!exchangeResponse.ok || exchangeResponse.body.appliedChanges.length !== 1) {
  throw new Error("Expected transport exchange to apply one change");
}

const missingDescriptor = sync.createNearFieldEndpointDescriptor({
  deviceId: "device_missing",
  baseUrl: "http://192.168.1.99:43110"
});
const missingResponse = await sync.sendNearFieldRequest({
  transport,
  descriptor: missingDescriptor,
  route: "/sync/summary",
  senderDeviceId: phoneDevice.id,
  body: {},
  now,
  ids
});

if (missingResponse.ok || missingResponse.error?.code !== "not-found") {
  throw new Error("Expected missing transport endpoint to return not-found");
}

const mismatchedTransport = {
  async send(_descriptor, request) {
    return sync.createNearFieldResponse({
      requestId: request.requestId,
      responderDeviceId: "device_intruder",
      body: { deviceId: "device_intruder", lastLamport: 0, changeCount: 0, attachmentCount: 0 },
      now
    });
  }
};

try {
  await sync.sendNearFieldRequest({
    transport: mismatchedTransport,
    descriptor: desktopNearField.descriptor,
    route: "/sync/summary",
    senderDeviceId: phoneDevice.id,
    body: {},
    now,
    ids
  });
  throw new Error("Expected responder device mismatch to be rejected");
} catch (error) {
  if (!String(error.message).includes("responder device id mismatch")) {
    throw error;
  }
}

const nonJsonDesktopTransport = new desktopNetwork.DesktopLocalNetworkTransportAdapter({
  fetchImpl: async () => new Response("<html>offline</html>", {
    status: 503,
    headers: { "content-type": "text/html" }
  }),
  timeoutMs: 50
});

const desktopNonJsonResponse = await sync.sendNearFieldRequest({
  transport: nonJsonDesktopTransport,
  descriptor: desktopNearField.descriptor,
  route: "/sync/summary",
  senderDeviceId: phoneDevice.id,
  body: {},
  now,
  ids
});

if (desktopNonJsonResponse.ok || !desktopNonJsonResponse.error?.message.includes("non-JSON HTTP 503")) {
  throw new Error("Expected desktop local-network transport to return structured non-JSON failure");
}

const failedMobileTransport = new mobileNetwork.MobileLocalNetworkTransportAdapter({
  fetchImpl: async () => {
    throw new Error("ECONNREFUSED");
  },
  timeoutMs: 50
});

const mobileFailureResponse = await sync.sendNearFieldRequest({
  transport: failedMobileTransport,
  descriptor: desktopNearField.descriptor,
  route: "/sync/summary",
  senderDeviceId: phoneDevice.id,
  body: {},
  now,
  ids
});

if (mobileFailureResponse.ok || !mobileFailureResponse.error?.message.includes("ECONNREFUSED")) {
  throw new Error("Expected mobile local-network transport to return structured network failure");
}

console.log("Near-field transport smoke test passed.");
console.log(
  JSON.stringify(
    {
      summaryDeviceId: summaryResponse.body.deviceId,
      appliedChanges: exchangeResponse.body.appliedChanges.length,
      missingError: missingResponse.error.code,
      responderMismatchRejected: true,
      desktopNonJsonError: desktopNonJsonResponse.error.message,
      mobileNetworkError: mobileFailureResponse.error.message
    },
    null,
    2
  )
);
