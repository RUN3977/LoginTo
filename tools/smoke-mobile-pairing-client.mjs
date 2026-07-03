const sync = await import("../packages/sync-core/src/index.ts");
const desktopTransport = await import("../apps/desktop/src/local-network-transport.ts");
const mobileTransport = await import("../apps/mobile/src/local-network-transport.ts");
const mobilePairingClient = await import("../apps/mobile/src/pairing-client.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T18:45:00.000Z";
const pairingPort = 43187;

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_pairing",
  name: "Desktop Pairing Host",
  kind: "desktop",
  publicKeyBase64: "desktop-pairing-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_pairing",
  name: "Phone Pairing Client",
  kind: "phone",
  publicKeyBase64: "phone-pairing-key",
  now,
  ids
});

const desktopSession = new sync.NearFieldSyncSession({
  localDevice: desktopDevice
});
const phoneSession = new sync.NearFieldSyncSession({
  localDevice: phoneDevice
});

const desktopPairingPayload = sync.createPairingPayload({
  device: desktopDevice,
  localEndpoint: `http://127.0.0.1:${pairingPort}`,
  ttlSeconds: 300,
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
  const transport = new mobileTransport.MobileLocalNetworkTransportAdapter();
  const pairingQr = sync.encodePairingPayloadQr(desktopPairingPayload);
  const qrScannedTarget = mobilePairingClient.scanDesktopPairingQr({
    payloadText: pairingQr.payloadText,
    now: now()
  });
  const scannedTarget = mobilePairingClient.scanDesktopPairingMatrix({
    matrix: sync.encodePairingPayloadMatrix(desktopPairingPayload),
    now: now()
  });
  if (qrScannedTarget.pairingPayload.sessionId !== scannedTarget.pairingPayload.sessionId) {
    throw new Error("Expected QR scan text and legacy pairing matrix to resolve the same desktop target");
  }
  const result = await mobilePairingClient.sendMobilePairingRequest({
    transport,
    descriptor: qrScannedTarget.descriptor,
    localDevice: phoneDevice,
    localEndpoint: "http://127.0.0.1:43111",
    ttlSeconds: 300,
    now,
    ids
  });

  if (result.verification.sixDigitCode !== result.response.body.verification.sixDigitCode) {
    throw new Error("Expected mobile and desktop pairing codes to match");
  }

  const trustedDesktop = mobilePairingClient.confirmMobilePairingTrust({
    session: result.session,
    trustedDevices: phoneSession.trustedDevices,
    confirmedCode: result.verification.sixDigitCode,
    trustedAt: "2026-06-06T18:46:00.000Z"
  });

  if (!phoneSession.trustedDevices.isTrusted(desktopDevice.id)) {
    throw new Error("Expected mobile pairing client to trust the desktop device after confirmation");
  }

  console.log("Mobile pairing client smoke test passed.");
  console.log(
    JSON.stringify(
      {
        baseUrl: server.baseUrl,
        scannedDevice: qrScannedTarget.deviceName,
        qrFormat: pairingQr.format,
        pairingCode: result.verification.sixDigitCode,
        remoteDevice: result.remotePayload.device.id,
        trustedDesktop: trustedDesktop.id,
        trustedDevices: phoneSession.trustedDevices.list().length
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
