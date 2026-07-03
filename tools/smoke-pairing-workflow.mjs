const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T17:00:00.000Z";

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

const desktopPairing = new sync.FaceToFacePairingSession({
  localDevice: desktopDevice,
  localEndpoint: "http://192.168.1.2:43110",
  ttlSeconds: 300,
  now,
  ids
});

const phonePairing = new sync.FaceToFacePairingSession({
  localDevice: phoneDevice,
  localEndpoint: "http://192.168.1.3:43110",
  ttlSeconds: 300,
  now,
  ids
});

const desktopVerification = desktopPairing.receiveRemotePayload(phonePairing.localPayload);
const phoneVerification = phonePairing.receiveRemotePayload(desktopPairing.localPayload);

if (desktopVerification.sixDigitCode !== phoneVerification.sixDigitCode) {
  throw new Error("Expected both devices to display the same pairing code");
}

desktopPairing.markVerified("2026-06-06T17:01:00.000Z");
phonePairing.markVerified("2026-06-06T17:01:00.000Z");

const desktopTrustedDevices = new sync.TrustedDeviceStore();
const phoneTrustedDevices = new sync.TrustedDeviceStore();
const trustedPhone = desktopPairing.confirmTrustedDevice(desktopTrustedDevices, "2026-06-06T17:02:00.000Z");
const trustedDesktop = phonePairing.confirmTrustedDevice(phoneTrustedDevices, "2026-06-06T17:02:00.000Z");

if (!desktopTrustedDevices.isTrusted(phoneDevice.id) || !phoneTrustedDevices.isTrusted(desktopDevice.id)) {
  throw new Error("Expected both devices to trust each other after confirmation");
}

if (trustedPhone.id !== phoneDevice.id || trustedDesktop.id !== desktopDevice.id) {
  throw new Error("Expected trusted devices to match remote payload devices");
}

const expiredDevice = sync.createDeviceIdentity({
  id: "device_tablet",
  name: "Tablet",
  kind: "tablet",
  publicKeyBase64: "tablet-key",
  now,
  ids
});
const expiredPairing = new sync.FaceToFacePairingSession({
  localDevice: expiredDevice,
  ttlSeconds: 1,
  now,
  ids
});
const expiredStatus = expiredPairing.refreshExpiredStatus("2026-06-06T17:00:02.000Z");

if (expiredStatus !== "expired") {
  throw new Error(`Expected expired pairing status, got ${expiredStatus}`);
}

console.log("Pairing workflow smoke test passed.");
console.log(
  JSON.stringify(
    {
      code: desktopVerification.sixDigitCode,
      desktopStatus: desktopPairing.status,
      phoneStatus: phonePairing.status,
      trustedDesktopDevices: desktopTrustedDevices.list().length,
      trustedPhoneDevices: phoneTrustedDevices.list().length,
      expiredStatus
    },
    null,
    2
  )
);
