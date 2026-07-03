const fixedNow = () => "2026-06-05T15:30:00.000Z";

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");

const manifest = vault.createVaultManifest({
  name: "Main Vault",
  deviceId: "device_desktop_1",
  now: fixedNow,
  ids
});

const draft = vault.createRecordDraft({
  type: "membership",
  title: "Costco 会员",
  values: {
    member_name: "Costco",
    member_id: "A123456",
    expires_at: "2026-12-31T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-12-24T09:00:00.000Z",
      message: "Costco 会员 7 天后到期",
      daysBefore: 7
    }
  ]
});

const record = vault.createVaultRecord({
  draft,
  encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
  now: fixedNow,
  ids
});

const repository = new vault.InMemoryVaultRepository(manifest, fixedNow);
repository.insertRecord(record);

const renewalTag = vault.createTag({
  name: "renewal",
  color: "#0F766E",
  ids
});
repository.upsertTag(renewalTag);
repository.updateRecordMetadata(record.id, {
  favorite: true,
  tagIds: [renewalTag.id]
});

repository.updateRecordFields(
  record.id,
  [
    {
      key: "level",
      value: "Gold"
    }
  ],
  crypto.createUnsafeDevelopmentFieldEncryptor()
);

const attachment = vault.createAttachmentRef({
  recordId: record.id,
  encryptedBlobPath: "attachments/attachment_1.blob",
  mimeType: "image/jpeg",
  digest: "sha256-test-digest",
  encryptedSize: 128,
  source: "camera",
  now: fixedNow,
  ids
});

repository.addAttachment(record.id, attachment);

const storage = new vault.InMemoryVaultStorageAdapter();
const snapshot = await repository.saveToStorage(storage);
const restoredRepository = await vault.InMemoryVaultRepository.loadFromStorage(storage, fixedNow);

if (!restoredRepository) {
  throw new Error("Expected restored repository");
}

const records = repository.listRecords();
const restoredRecords = restoredRepository.listRecords();
const searchResults = repository.searchRecords("renewal");

const vaultPackage = vault.createVaultPackage({
  snapshot,
  keyPurpose: "backup-package",
  encryptPayload: crypto.createUnsafeDevelopmentPackageEncryptor(),
  now: fixedNow,
  ids
});
const parsedPackage = vault.parseVaultPackage(vault.serializeVaultPackage(vaultPackage));
const packageSnapshot = vault.restoreSnapshotFromVaultPackage(
  parsedPackage,
  crypto.createUnsafeDevelopmentPackageDecryptor()
);

vault.assertSqliteSchemaStatements();
const sqliteStatements = [];
const sqliteExecutor = {
  async execute(sql, params) {
    sqliteStatements.push({ sql, params: params ?? [] });
  },
  async query() {
    return { rows: [] };
  },
  async transaction(work) {
    return work(this);
  }
};
await vault.initializeSqliteVaultSchema(sqliteExecutor);

if (records.length !== 1) {
  throw new Error(`Expected 1 record, got ${records.length}`);
}

if (searchResults.length !== 1) {
  throw new Error(`Expected 1 search result, got ${searchResults.length}`);
}

if (restoredRecords.length !== 1) {
  throw new Error(`Expected 1 restored record, got ${restoredRecords.length}`);
}

if (restoredRepository.listTags().length !== 1) {
  throw new Error(`Expected 1 restored tag, got ${restoredRepository.listTags().length}`);
}

if (restoredRepository.listCategories().length < 6) {
  throw new Error(`Expected built-in categories after restore, got ${restoredRepository.listCategories().length}`);
}

if (packageSnapshot.records.length !== 1) {
  throw new Error(`Expected 1 package-restored record, got ${packageSnapshot.records.length}`);
}

if (vaultPackage.attachments.length !== 1) {
  throw new Error(`Expected 1 package attachment, got ${vaultPackage.attachments.length}`);
}

if (sqliteStatements.length < 6) {
  throw new Error(`Expected SQLite schema statements, got ${sqliteStatements.length}`);
}

if (records[0].reminders.length !== 1) {
  throw new Error(`Expected 1 reminder, got ${records[0].reminders.length}`);
}

if (records[0].attachments.length !== 1) {
  throw new Error(`Expected 1 attachment, got ${records[0].attachments.length}`);
}

if (records[0].fields.length !== 4) {
  throw new Error(`Expected 4 fields after update, got ${records[0].fields.length}`);
}

if (!records[0].fields[0].valueCipher.startsWith("unsafe-dev-plain-v1:")) {
  throw new Error("Expected development ciphertext marker");
}

console.log("Vault smoke test passed.");
console.log(
  JSON.stringify(
    {
      vault: repository.getManifest().name,
      records: records.length,
      categories: repository.listCategories().length,
      tags: repository.listTags().length,
      searchResults: searchResults.length,
      reminders: records[0].reminders.length,
      attachments: records[0].attachments.length,
      restoredRecords: restoredRecords.length,
      packageRecords: packageSnapshot.records.length,
      packageAttachments: vaultPackage.attachments.length,
      sqliteStatements: sqliteStatements.length,
      fieldCipherPrefix: records[0].fields[0].valueCipher.split(":")[0]
    },
    null,
    2
  )
);
