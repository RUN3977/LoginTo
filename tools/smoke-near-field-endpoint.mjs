const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T11:45:00.000Z";

const descriptor = sync.createNearFieldEndpointDescriptor({
  deviceId: "device_desktop",
  baseUrl: "http://192.168.1.2:43110/"
});
sync.assertNearFieldEndpointDescriptor(descriptor);

const request = sync.createNearFieldRequest({
  route: "/sync/summary",
  senderDeviceId: "device_phone",
  body: {
    deviceId: "device_phone",
    lastLamport: 3,
    changeCount: 7,
    attachmentCount: 2
  },
  now,
  ids
});
sync.assertNearFieldRequest(request);

const response = sync.createNearFieldResponse({
  requestId: request.requestId,
  responderDeviceId: "device_desktop",
  body: {
    deviceId: "device_desktop",
    lastLamport: 5,
    changeCount: 9,
    attachmentCount: 1
  },
  now
});
sync.assertNearFieldResponse(response);

const errorResponse = sync.createNearFieldResponse({
  requestId: request.requestId,
  responderDeviceId: "device_desktop",
  error: {
    code: "not-trusted",
    message: "Device is not trusted"
  },
  now
});
sync.assertNearFieldResponse(errorResponse);

if (descriptor.routes["/sync/exchange"] !== "http://192.168.1.2:43110/sync/exchange") {
  throw new Error("Expected normalized sync exchange route");
}

if (!response.ok || errorResponse.ok) {
  throw new Error("Expected response ok flags to match");
}

console.log("Near-field endpoint smoke test passed.");
console.log(
  JSON.stringify(
    {
      baseUrl: descriptor.baseUrl,
      requestRoute: request.route,
      okResponse: response.ok,
      errorCode: errorResponse.error?.code
    },
    null,
    2
  )
);
