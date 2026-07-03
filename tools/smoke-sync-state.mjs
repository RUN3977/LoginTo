const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-06T09:45:00.000Z";
const device = sync.createDeviceIdentity({
  name: "Phone",
  kind: "phone",
  publicKeyBase64: "phone-key",
  now,
  ids
});

const trustedDevices = new sync.TrustedDeviceStore();
const trusted = trustedDevices.trust({ device, trustedAt: now() });
trustedDevices.updateLastSeen(trusted.id, "2026-06-06T09:50:00.000Z");

if (!trustedDevices.isTrusted(trusted.id)) {
  throw new Error("Expected trusted device");
}

const changeLog = new sync.SyncChangeLog();
const first = sync.createSyncChange({
  entity: "record",
  entityId: "record_1",
  operation: "create",
  deviceId: "device_desktop",
  lamport: 1,
  payloadCipher: "cipher-1",
  createdAt: "2026-06-06T09:46:00.000Z",
  ids
});
const second = sync.createSyncChange({
  entity: "field",
  entityId: "record_1:username",
  operation: "update",
  deviceId: "device_desktop",
  lamport: 2,
  payloadCipher: "cipher-2",
  createdAt: "2026-06-06T09:47:00.000Z",
  ids
});

changeLog.append(first);
changeLog.append(first);
changeLog.append(second);

if (changeLog.list().length !== 2) {
  throw new Error(`Expected deduped change log length 2, got ${changeLog.list().length}`);
}

const remoteSummary = {
  deviceId: trusted.id,
  lastLamport: 1,
  changeCount: 1,
  attachmentCount: 0
};
const changesForRemote = sync.getChangesForRemote(remoteSummary, changeLog);

if (changesForRemote.length !== 1 || changesForRemote[0].lamport !== 2) {
  throw new Error("Expected only changes after remote lamport");
}

trustedDevices.revoke(trusted.id);
if (trustedDevices.isTrusted(trusted.id)) {
  throw new Error("Expected revoked device to be untrusted");
}

console.log("Sync state smoke test passed.");
console.log(
  JSON.stringify(
    {
      trustedBeforeRevoke: true,
      trustedAfterRevoke: trustedDevices.isTrusted(trusted.id),
      changeLog: changeLog.list().length,
      changesForRemote: changesForRemote.length
    },
    null,
    2
  )
);
