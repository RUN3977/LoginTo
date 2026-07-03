const sync = await import("../packages/sync-core/src/index.ts");
const desktopSync = await import("../apps/desktop/src/sync-session.ts");
const mobileSync = await import("../apps/mobile/src/sync-session.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T11:20:00.000Z";

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

const phoneChange = sync.createSyncChange({
  entity: "tag",
  entityId: "tag_phone",
  operation: "create",
  deviceId: phoneDevice.id,
  lamport: 1,
  payloadCipher: "phone-tag-cipher",
  createdAt: "2026-06-06T11:15:00.000Z",
  ids
});

const desktopSession = desktopSync.createDesktopNearFieldSyncSession({
  localDevice: desktopDevice
});
desktopSession.trustDevice(phoneDevice, now());

const phoneSession = mobileSync.createMobileNearFieldSyncSession({
  localDevice: phoneDevice,
  trustedDevices: [desktopDevice],
  changes: [phoneChange]
});

const exchangePackage = phoneSession.createOutgoingExchangePackage({
  receiverDeviceId: desktopDevice.id,
  sessionId: "sync_session_phone_desktop",
  confirmationId: "sync_confirmation_phone_desktop",
  now,
  ids
});

try {
  desktopSession.receiveExchangePackage({
    exchangePackage,
    transport: "local-network",
    expectedConfirmationId: "wrong_confirmation",
    now,
    ids
  });
  throw new Error("Expected confirmation-bound exchange package to reject a mismatched confirmation id");
} catch (error) {
  if (!String(error.message).includes("confirmation binding mismatch")) {
    throw error;
  }
}

const report = desktopSession.receiveExchangePackage({
  exchangePackage,
  transport: "local-network",
  expectedSessionId: "sync_session_phone_desktop",
  expectedConfirmationId: "sync_confirmation_phone_desktop",
  now,
  ids
});

if (report.appliedChanges.length !== 1) {
  throw new Error(`Expected 1 applied change, got ${report.appliedChanges.length}`);
}

if (desktopSession.changeLog.list().length !== 1) {
  throw new Error(`Expected desktop change log length 1, got ${desktopSession.changeLog.list().length}`);
}

if (desktopSession.importJournal.list().length !== 1) {
  throw new Error(`Expected import journal length 1, got ${desktopSession.importJournal.list().length}`);
}

try {
  desktopSession.receiveExchangePackage({
    exchangePackage,
    transport: "local-network",
    expectedSessionId: "sync_session_phone_desktop",
    expectedConfirmationId: "sync_confirmation_phone_desktop",
    now,
    ids
  });
  throw new Error("Expected repeated exchange package import to be rejected");
} catch (error) {
  if (!String(error.message).includes("already imported")) {
    throw error;
  }
}

if (!desktopSession.trustedDevices.get(phoneDevice.id)?.lastSeenAt) {
  throw new Error("Expected trusted phone lastSeenAt to be updated");
}

console.log("Near-field sync session smoke test passed.");
console.log(
  JSON.stringify(
    {
      appliedChanges: report.appliedChanges.length,
      sessionId: exchangePackage.sessionId,
      confirmationId: exchangePackage.confirmationId,
      desktopChangeLog: desktopSession.changeLog.list().length,
      importEntries: desktopSession.importJournal.list().length,
      transport: report.result.transport
    },
    null,
    2
  )
);
