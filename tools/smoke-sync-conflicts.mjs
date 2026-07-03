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
const now = () => "2026-06-06T09:15:00.000Z";

const localChanges = [
  sync.createSyncChange({
    entity: "record",
    entityId: "record_shared",
    operation: "update",
    deviceId: localDeviceId,
    lamport: 4,
    payloadCipher: "cipher-local-title",
    createdAt: "2026-06-06T09:00:00.000Z",
    ids
  })
];

const remoteChanges = [
  sync.createSyncChange({
    entity: "record",
    entityId: "record_shared",
    operation: "update",
    deviceId: remoteDeviceId,
    lamport: 5,
    payloadCipher: "cipher-remote-title",
    createdAt: "2026-06-06T09:01:00.000Z",
    ids
  }),
  sync.createSyncChange({
    entity: "attachment",
    entityId: "attachment_remote",
    operation: "create",
    deviceId: remoteDeviceId,
    lamport: 6,
    payloadCipher: "cipher-remote-attachment",
    createdAt: "2026-06-06T09:02:00.000Z",
    ids
  })
];

const plan = sync.createSyncMergePlan({
  localDeviceId,
  remoteDeviceId,
  localChanges,
  remoteChanges,
  now,
  ids
});

if (plan.conflicts.length !== 1) {
  throw new Error(`Expected 1 conflict, got ${plan.conflicts.length}`);
}

if (plan.applyRemoteChanges.length !== 1) {
  throw new Error(`Expected 1 applyable remote change, got ${plan.applyRemoteChanges.length}`);
}

if (plan.applyRemoteChanges[0].entity !== "attachment") {
  throw new Error("Expected attachment change to remain applyable");
}

const resolved = sync.resolveSyncConflict(plan.conflicts[0], "use-remote", "2026-06-06T09:20:00.000Z");
if (resolved.status !== "resolved" || !resolved.resolvedAt) {
  throw new Error("Expected resolved conflict");
}

const changeLog = new sync.SyncChangeLog(localChanges);
const applied = sync.applySyncMergePlan({
  mergePlan: plan,
  changeLog,
  transport: "local-network",
  decisions: [
    {
      conflictId: plan.conflicts[0].id,
      resolution: "use-remote"
    }
  ],
  exchangePackageId: "exchange_conflict_smoke",
  now,
  ids
});
if (applied.resolvedConflicts.length !== 1 || applied.pendingConflicts.length !== 0) {
  throw new Error("Expected conflict decision to resolve the pending conflict during apply");
}
if (!applied.importEntry.conflictIds.includes(plan.conflicts[0].id)) {
  throw new Error("Expected import journal to retain the resolved conflict id");
}

const manualMergeLog = new sync.SyncChangeLog(localChanges);
const manualMerged = sync.applySyncMergePlan({
  mergePlan: plan,
  changeLog: manualMergeLog,
  transport: "local-network",
  decisions: [
    {
      conflictId: plan.conflicts[0].id,
      resolution: "manual-merge",
      manualMerge: {
        fields: [
          { fieldKey: "title", source: "local", sensitivity: "normal" },
          { fieldKey: "notes", source: "remote", sensitivity: "secret" }
        ]
      }
    }
  ],
  exchangePackageId: "exchange_manual_merge_smoke",
  now,
  ids
});
const manualConflict = manualMerged.resolvedConflicts[0];
if (manualConflict.resolution !== "manual-merge" || manualConflict.manualMerge?.fields.length !== 2) {
  throw new Error("Expected manual merge conflict decision to retain field-level choices");
}
if (manualMergeLog.list().some((change) => change.id === remoteChanges[0].id)) {
  throw new Error("Expected manual merge to avoid silently applying the whole remote record change");
}

console.log("Sync conflict smoke test passed.");
console.log(
  JSON.stringify(
    {
      conflicts: plan.conflicts.length,
      applyRemoteChanges: plan.applyRemoteChanges.length,
      resolvedStatus: resolved.status,
      appliedResolvedConflicts: applied.resolvedConflicts.length,
      manualMergeFields: manualConflict.manualMerge.fields.length,
      conflictEntity: plan.conflicts[0].entity
    },
    null,
    2
  )
);
