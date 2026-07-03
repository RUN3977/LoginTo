const sync = await import("../packages/sync-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const localDeviceId = "device_desktop";
const remoteDeviceId = "device_phone";
const now = () => "2026-06-06T10:10:00.000Z";

const localLog = new sync.SyncChangeLog([
  sync.createSyncChange({
    entity: "record",
    entityId: "record_shared",
    operation: "update",
    deviceId: localDeviceId,
    lamport: 3,
    payloadCipher: "local-record-cipher",
    createdAt: "2026-06-06T10:00:00.000Z",
    ids
  })
]);

const remoteChanges = [
  sync.createSyncChange({
    entity: "record",
    entityId: "record_shared",
    operation: "update",
    deviceId: remoteDeviceId,
    lamport: 4,
    payloadCipher: "remote-record-cipher",
    createdAt: "2026-06-06T10:01:00.000Z",
    ids
  }),
  sync.createSyncChange({
    entity: "tag",
    entityId: "tag_remote",
    operation: "create",
    deviceId: remoteDeviceId,
    lamport: 5,
    payloadCipher: "remote-tag-cipher",
    createdAt: "2026-06-06T10:02:00.000Z",
    ids
  })
];

const exchangePackage = sync.createSyncExchangePackage({
  senderDeviceId: remoteDeviceId,
  receiverDeviceId: localDeviceId,
  sessionId: "sync_session_smoke",
  confirmationId: "sync_confirmation_smoke",
  changes: remoteChanges,
  now,
  ids
});

const parsed = sync.parseSyncExchangePackage(sync.serializeSyncExchangePackage(exchangePackage));
const cryptoAdapter = crypto.createWebCryptoAesGcmAdapter();
const cryptoKey = await cryptoAdapter.deriveKey("sync-exchange-smoke-secret", {
  ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  saltBase64: Buffer.from("sync-exchange-smoke-salt").toString("base64")
});
const encryptedPackage = await sync.encryptSyncExchangePackage({
  exchangePackage: parsed,
  adapter: cryptoAdapter,
  key: cryptoKey
});
const encryptedJson = JSON.stringify(encryptedPackage);
if (encryptedJson.includes("remote-record-cipher") || encryptedJson.includes("remote-tag-cipher") || "changes" in encryptedPackage) {
  throw new Error("Expected encrypted sync package to hide plaintext changes");
}
const decryptedPackage = await sync.decryptSyncExchangePackage({
  encryptedPackage,
  adapter: cryptoAdapter,
  key: cryptoKey
});
if (decryptedPackage.packageId !== parsed.packageId || decryptedPackage.changes.length !== parsed.changes.length) {
  throw new Error("Expected encrypted sync package to decrypt back to the original exchange package");
}
try {
  await sync.decryptSyncExchangePackage({
    encryptedPackage: {
      ...encryptedPackage,
      confirmationId: "tampered-confirmation"
    },
    adapter: cryptoAdapter,
    key: cryptoKey
  });
  throw new Error("Expected encrypted sync package AAD tampering to be rejected");
} catch (error) {
  if (!String(error.message).includes("decrypt") && !String(error.message).includes("operation")) {
    throw error;
  }
}
const mergePlan = sync.createMergePlanFromExchange({
  localDeviceId,
  localChangeLog: localLog,
  exchangePackage: parsed,
  now,
  ids
});

if (parsed.summary.changeCount !== 2) {
  throw new Error(`Expected 2 exchange changes, got ${parsed.summary.changeCount}`);
}

if (parsed.sessionId !== "sync_session_smoke" || parsed.confirmationId !== "sync_confirmation_smoke" || !parsed.contentDigest?.startsWith("fnv1a32:")) {
  throw new Error("Expected exchange package to include session binding and content digest");
}

const tampered = {
  ...parsed,
  changes: [
    {
      ...parsed.changes[0],
      payloadCipher: "tampered-record-cipher"
    },
    ...parsed.changes.slice(1)
  ]
};
try {
  sync.parseSyncExchangePackage(JSON.stringify(tampered));
  throw new Error("Expected tampered exchange package to be rejected");
} catch (error) {
  if (!String(error.message).includes("content digest mismatch")) {
    throw error;
  }
}

if (mergePlan.conflicts.length !== 1) {
  throw new Error(`Expected 1 exchange conflict, got ${mergePlan.conflicts.length}`);
}

if (mergePlan.applyRemoteChanges.length !== 1 || mergePlan.applyRemoteChanges[0].entity !== "tag") {
  throw new Error("Expected remote tag change to be applyable");
}

console.log("Sync exchange smoke test passed.");
console.log(
  JSON.stringify(
    {
      packageId: parsed.packageId,
      sessionId: parsed.sessionId,
      confirmationId: parsed.confirmationId,
      contentDigest: parsed.contentDigest,
      changes: parsed.summary.changeCount,
      conflicts: mergePlan.conflicts.length,
      applyRemoteChanges: mergePlan.applyRemoteChanges.length
    },
    null,
    2
  )
);
