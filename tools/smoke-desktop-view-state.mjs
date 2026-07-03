const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");
const view = await import("../apps/desktop/src/view-state.ts");

const fixedNow = () => "2026-06-05T17:05:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const manifest = vault.createVaultManifest({
  name: "View State Smoke",
  deviceId: "device_view_state",
  now: fixedNow,
  ids
});

const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);
const tag = vault.createTag({ name: "view", ids });
repository.upsertTag(tag);

const draft = vault.createRecordDraft({
  type: "membership",
  title: "Streaming Membership",
  values: {
    member_name: "Streaming",
    member_id: "stream-123",
    expires_at: "2026-08-01T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-07-25T09:00:00.000Z",
      message: "Streaming membership expires soon",
      daysBefore: 7
    }
  ]
});

const record = repository.insertRecord(
  vault.createVaultRecord({
    draft,
    tagIds: [tag.id],
    encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
    now: fixedNow,
    ids
  })
);

const state = view.buildDesktopVaultViewState(repository, {
  query: "view",
  selectedRecordId: record.id
});

if (state.records.length !== 1) {
  throw new Error(`Expected 1 view-state record, got ${state.records.length}`);
}

if (!state.selectedRecord) {
  throw new Error("Expected selected record");
}

if (state.reminders.length !== 1) {
  throw new Error(`Expected 1 reminder item, got ${state.reminders.length}`);
}

if (state.categories.length < 6) {
  throw new Error(`Expected built-in categories, got ${state.categories.length}`);
}

console.log("Desktop view-state smoke test passed.");
console.log(
  JSON.stringify(
    {
      vaultName: state.vaultName,
      records: state.records.length,
      categories: state.categories.length,
      reminders: state.reminders.length,
      selectedSecretFields: state.selectedRecord.secretFieldCount
    },
    null,
    2
  )
);
