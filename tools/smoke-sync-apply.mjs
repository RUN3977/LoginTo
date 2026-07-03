const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const localDeviceId = "device_desktop";
const remoteDeviceId = "device_phone";
const now = () => "2026-06-06T10:45:00.000Z";

const localLog = new sync.SyncChangeLog([
  sync.createSyncChange({
    entity: "record",
    entityId: "record_shared",
    operation: "update",
    deviceId: localDeviceId,
    lamport: 7,
    payloadCipher: "local-update",
    createdAt: "2026-06-06T10:30:00.000Z",
    ids
  })
]);

const remoteChanges = [
  sync.createSyncChange({
    entity: "record",
    entityId: "record_shared",
    operation: "update",
    deviceId: remoteDeviceId,
    lamport: 8,
    payloadCipher: "remote-update",
    createdAt: "2026-06-06T10:31:00.000Z",
    ids
  }),
  sync.createSyncChange({
    entity: "attachment",
    entityId: "attachment_remote",
    operation: "create",
    deviceId: remoteDeviceId,
    lamport: 9,
    payloadCipher: "remote-attachment",
    createdAt: "2026-06-06T10:32:00.000Z",
    ids
  })
];

const exchangePackage = sync.createSyncExchangePackage({
  senderDeviceId: remoteDeviceId,
  receiverDeviceId: localDeviceId,
  changes: remoteChanges,
  now,
  ids
});

const mergePlan = sync.createMergePlanFromExchange({
  localDeviceId,
  localChangeLog: localLog,
  exchangePackage,
  now,
  ids
});

const report = sync.applySyncMergePlan({
  mergePlan,
  changeLog: localLog,
  transport: "encrypted-package",
  exchangePackageId: exchangePackage.packageId,
  decisions: [
    {
      conflictId: mergePlan.conflicts[0].id,
      resolution: "use-remote"
    }
  ],
  now,
  ids
});

const journal = new sync.SyncImportJournal();
journal.append(report.importEntry);

if (report.pendingConflicts.length !== 0) {
  throw new Error(`Expected no pending conflicts, got ${report.pendingConflicts.length}`);
}

if (report.resolvedConflicts.length !== 1) {
  throw new Error(`Expected 1 resolved conflict, got ${report.resolvedConflicts.length}`);
}

if (report.appliedChanges.length !== 2) {
  throw new Error(`Expected 2 applied changes, got ${report.appliedChanges.length}`);
}

if (report.result.attachmentsTransferred !== 1) {
  throw new Error(`Expected 1 transferred attachment, got ${report.result.attachmentsTransferred}`);
}

if (!journal.hasImportedChange(remoteChanges[0].id) || !journal.hasImportedChange(remoteChanges[1].id)) {
  throw new Error("Expected import journal to track applied remote changes");
}

if (localLog.list().length !== 3) {
  throw new Error(`Expected local change log length 3, got ${localLog.list().length}`);
}

console.log("Sync apply smoke test passed.");
console.log(
  JSON.stringify(
    {
      appliedChanges: report.appliedChanges.length,
      resolvedConflicts: report.resolvedConflicts.length,
      pendingConflicts: report.pendingConflicts.length,
      attachmentsTransferred: report.result.attachmentsTransferred,
      journalEntries: journal.list().length
    },
    null,
    2
  )
);
