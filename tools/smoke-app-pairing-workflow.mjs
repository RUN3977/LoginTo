const sync = await import("../packages/sync-core/src/index.ts");
const desktopPairing = await import("../apps/desktop/src/pairing-workflow.ts");
const mobilePairing = await import("../apps/mobile/src/pairing-workflow.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T17:25:00.000Z";

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

const desktopSession = desktopPairing.createDesktopPairingSession({
  localDevice: desktopDevice,
  localEndpoint: "http://192.168.1.2:43110",
  ttlSeconds: 300,
  now,
  ids
});

const phoneSession = mobilePairing.createMobilePairingSession({
  localDevice: phoneDevice,
  localEndpoint: "http://192.168.1.3:43110",
  ttlSeconds: 300,
  now,
  ids
});

const desktopVerification = desktopSession.receiveRemotePayload(phoneSession.localPayload);
const phoneVerification = phoneSession.receiveRemotePayload(desktopSession.localPayload);

if (desktopVerification.sixDigitCode !== phoneVerification.sixDigitCode) {
  throw new Error("Expected app pairing wrappers to produce the same verification code");
}

desktopSession.markVerified("2026-06-06T17:26:00.000Z");
phoneSession.markVerified("2026-06-06T17:26:00.000Z");

const desktopNearField = new sync.NearFieldSyncSession({
  localDevice: desktopDevice
});
const phoneNearField = new sync.NearFieldSyncSession({
  localDevice: phoneDevice
});

const trustedPhone = desktopSession.confirmTrustedDevice(desktopNearField.trustedDevices, "2026-06-06T17:27:00.000Z");
const trustedDesktop = phoneSession.confirmTrustedDevice(phoneNearField.trustedDevices, "2026-06-06T17:27:00.000Z");

if (!desktopNearField.trustedDevices.isTrusted(phoneDevice.id)) {
  throw new Error("Expected desktop sync session to trust phone after app pairing");
}

if (!phoneNearField.trustedDevices.isTrusted(desktopDevice.id)) {
  throw new Error("Expected phone sync session to trust desktop after app pairing");
}

console.log("App pairing workflow smoke test passed.");
console.log(
  JSON.stringify(
    {
      pairingCode: desktopVerification.sixDigitCode,
      desktopStatus: desktopSession.status,
      phoneStatus: phoneSession.status,
      trustedPhone: trustedPhone.id,
      trustedDesktop: trustedDesktop.id
    },
    null,
    2
  )
);
