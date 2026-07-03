const sync = await import("../packages/sync-core/src/index.ts");
const desktopTransport = await import("../apps/desktop/src/local-network-transport.ts");
const mobileTransport = await import("../apps/mobile/src/local-network-transport.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T16:20:00.000Z";

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
  id: "sync_change_phone_tag",
  entity: "tag",
  entityId: "tag_phone",
  operation: "create",
  deviceId: phoneDevice.id,
  lamport: 1,
  payloadCipher: "encrypted-phone-tag",
  createdAt: "2026-06-06T16:10:00.000Z",
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
  const transport = new mobileTransport.MobileLocalNetworkTransportAdapter();
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

  if (!exchangeResponse.ok || exchangeResponse.body.appliedChanges.length !== 1) {
    throw new Error("Expected mobile local-network transport to apply one desktop change");
  }

  const hotspotTransport = new mobileTransport.MobileHotspotDirectTransportAdapter({
    gatewayHosts: ["172.20.10.1", "127.0.0.1"]
  });
  const hotspotTargets = hotspotTransport.createProbeTargets({
    ports: [4173],
    expectedProduct: "LoginTo desktop shell",
    expectedKind: "desktop",
    maxTargets: 2
  });
  if (
    hotspotTargets.length !== 2
    || hotspotTargets[0].transport !== "hotspot"
    || hotspotTargets[0].endpoint !== "http://172.20.10.1:4173"
  ) {
    throw new Error("Expected mobile hotspot adapter to create hotspot direct probe targets");
  }

  const hotspotPackage = phoneSession.createOutgoingExchangePackage({
    receiverDeviceId: desktopDevice.id,
    now,
    ids
  });
  const hotspotResponse = await sync.sendNearFieldRequest({
    transport: hotspotTransport,
    descriptor: server.descriptor,
    route: "/sync/exchange",
    senderDeviceId: phoneDevice.id,
    body: {
      exchangePackage: hotspotPackage,
      transport: "hotspot"
    },
    now,
    ids
  });

  if (!hotspotResponse.ok || hotspotResponse.body.result.transport !== "hotspot") {
    throw new Error("Expected mobile hotspot direct transport to preserve hotspot sync result");
  }

  console.log("Mobile local-network transport smoke test passed.");
  console.log(
    JSON.stringify(
      {
        baseUrl: server.baseUrl,
        appliedChanges: exchangeResponse.body.appliedChanges.length,
        transport: exchangeResponse.body.result.transport,
        hotspotTargets: hotspotTargets.map((target) => target.endpoint),
        hotspotTransport: hotspotResponse.body.result.transport
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
