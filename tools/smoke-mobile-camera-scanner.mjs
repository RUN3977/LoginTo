const desktopTransport = await import("../apps/desktop/src/local-network-transport.ts");
const mobileRuntime = await import("../apps/mobile/src/runtime.ts");
const cameraScanner = await import("../apps/mobile/src/camera-scanner.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-12T12:00:00.000Z";
const pairingPort = 43189;

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_camera_scan",
  name: "Camera Scan Desktop",
  kind: "desktop",
  publicKeyBase64: "camera-scan-desktop-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_camera_scan",
  name: "Camera Scan Phone",
  kind: "phone",
  publicKeyBase64: "camera-scan-phone-key",
  now,
  ids
});

const desktopPairingPayload = sync.createPairingPayload({
  device: desktopDevice,
  localEndpoint: `http://127.0.0.1:${pairingPort}`,
  ttlSeconds: 300,
  now,
  ids
});
const pairingQr = sync.encodePairingPayloadQr(desktopPairingPayload);

const desktopSession = new sync.NearFieldSyncSession({
  localDevice: desktopDevice
});

const phone = await mobileRuntime.createMobileRuntime({
  password: "camera-scan-password",
  vaultName: "Camera Scan Phone Vault",
  localDevice: phoneDevice,
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
  const scanner = cameraScanner.createStaticPairingQrScanner({
    payloadText: pairingQr.payloadText,
    scannedAt: now()
  });
  const pairing = await cameraScanner.scanPairingQrWithCamera({
    runtime: phone,
    scanner,
    localEndpoint: "http://127.0.0.1:43111",
    ttlSeconds: 300
  });

  if (pairing.scannedTarget.deviceName !== desktopDevice.name) {
    throw new Error("Expected camera scanner to resolve the desktop pairing target");
  }
  if (pairing.verification.sixDigitCode !== pairing.response.body.verification.sixDigitCode) {
    throw new Error("Expected camera scanner pairing verification code to match desktop response");
  }
  if (pairing.scan.type !== "qr" || pairing.scan.data !== pairingQr.payloadText) {
    throw new Error("Expected camera scanner to retain the raw QR scan result");
  }

  let denied = false;
  try {
    await cameraScanner.scanPairingQrWithCamera({
      runtime: phone,
      scanner: cameraScanner.createStaticPairingQrScanner({
        payloadText: pairingQr.payloadText,
        permission: {
          status: "denied",
          canAskAgain: false
        }
      })
    });
  } catch (error) {
    denied = /permission is denied/i.test(error.message);
  }
  if (!denied) {
    throw new Error("Expected camera scanner to reject denied camera permission");
  }

  console.log("Mobile camera scanner smoke test passed.");
  console.log(
    JSON.stringify(
      {
        scannedDevice: pairing.scannedTarget.deviceName,
        pairingCode: pairing.verification.sixDigitCode,
        qrFormat: pairingQr.format,
        permissionDenied: denied,
        endpoint: server.baseUrl
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
