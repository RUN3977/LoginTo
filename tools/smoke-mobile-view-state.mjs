const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");
const mobileView = await import("../apps/mobile/src/view-state.ts");

const fixedNow = () => "2026-06-06T00:45:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const manifest = vault.createVaultManifest({
  name: "Mobile View State",
  deviceId: "device_mobile_view",
  now: fixedNow,
  ids
});
const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);

const draft = vault.createRecordDraft({
  type: "membership",
  title: "Coffee Membership",
  values: {
    member_name: "Coffee",
    member_id: "COFFEE-1",
    expires_at: "2026-06-20T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-06-20T00:00:00.000Z",
      message: "Coffee membership expires soon",
      daysBefore: 7
    }
  ]
});

const record = repository.insertRecord(
  vault.createVaultRecord({
    draft,
    encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
    now: fixedNow,
    ids
  })
);
repository.updateRecordMetadata(record.id, { favorite: true });

const state = mobileView.buildMobileVaultViewState(repository, {
  query: "Coffee",
  now: "2026-06-13T00:00:00.000Z"
});

if (state.records.length !== 1) {
  throw new Error(`Expected 1 mobile record result, got ${state.records.length}`);
}

if (state.favorites.length !== 1) {
  throw new Error(`Expected 1 favorite, got ${state.favorites.length}`);
}

if (state.dueAlerts.length !== 1) {
  throw new Error(`Expected 1 due alert, got ${state.dueAlerts.length}`);
}

if (state.categories.length < 6) {
  throw new Error(`Expected built-in categories, got ${state.categories.length}`);
}

console.log("Mobile view-state smoke test passed.");
console.log(
  JSON.stringify(
    {
      vaultName: state.vaultName,
      records: state.records.length,
      favorites: state.favorites.length,
      dueAlerts: state.dueAlerts.length,
      categories: state.categories.length
    },
    null,
    2
  )
);
