const sync = await import("../packages/sync-core/src/index.ts");
const desktopTransport = await import("../apps/desktop/src/local-network-transport.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T15:55:00.000Z";

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
  id: "sync_change_phone_attachment",
  entity: "attachment",
  entityId: "attachment_phone",
  operation: "create",
  deviceId: phoneDevice.id,
  lamport: 1,
  payloadCipher: "encrypted-phone-attachment",
  createdAt: "2026-06-06T15:45:00.000Z",
  ids
});

const phoneSession = new sync.NearFieldSyncSession({
  localDevice: phoneDevice,
  trustedDevices: [desktopDevice],
  changes: [phoneChange]
});

const server = await desktopTransport.startDesktopLocalNetworkEndpoint({
  session: desktopSession,
  host: "127.0.0.1",
  port: 0,
  now,
  ids
});

try {
  const transport = new desktopTransport.DesktopLocalNetworkTransportAdapter();
  const summaryResponse = await sync.sendNearFieldRequest({
    transport,
    descriptor: server.descriptor,
    route: "/sync/summary",
    senderDeviceId: phoneDevice.id,
    body: {
      remoteSummary: phoneSession.getLocalSummary()
    },
    now,
    ids
  });

  if (!summaryResponse.ok || summaryResponse.body.deviceId !== desktopDevice.id) {
    throw new Error("Expected local-network summary response from desktop");
  }

  const exchangePackage = phoneSession.createOutgoingExchangePackage({
    receiverDeviceId: desktopDevice.id,
    now,
    ids
  });
  const exchangeResponse = await sync.sendNearFieldRequest({
    transport,
    descriptor: server.descriptor,
    route: "/sync/exchange",
    senderDeviceId: phoneDevice.id,
    body: {
      exchangePackage,
      transport: "local-network"
    },
    now,
    ids
  });

  if (!exchangeResponse.ok || exchangeResponse.body.result.attachmentsTransferred !== 1) {
    throw new Error("Expected local-network exchange to transfer one attachment change");
  }

  console.log("Desktop local-network transport smoke test passed.");
  console.log(
    JSON.stringify(
      {
        baseUrl: server.baseUrl,
        summaryDeviceId: summaryResponse.body.deviceId,
        appliedChanges: exchangeResponse.body.appliedChanges.length,
        attachmentsTransferred: exchangeResponse.body.result.attachmentsTransferred
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
