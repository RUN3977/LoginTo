const crypto = await import("../packages/crypto-core/src/index.ts");
const vault = await import("../packages/vault-core/src/index.ts");
const sync = await import("../packages/sync-core/src/index.ts");
const desktopSession = await import("../apps/desktop/src/vault-session.ts");
const desktopStorage = await import("../apps/desktop/src/file-vault-storage.ts");
const desktopTransport = await import("../apps/desktop/src/local-network-transport.ts");
const desktopPairing = await import("../apps/desktop/src/pairing-workflow.ts");
const mobilePairing = await import("../apps/mobile/src/pairing-workflow.ts");
const mobileCapture = await import("../apps/mobile/src/encrypted-capture.ts");
const mobileOcr = await import("../apps/mobile/src/ocr-capture-workflow.ts");
const { rm } = await import("node:fs/promises");
const { join } = await import("node:path");

const root = process.cwd();
const demoPath = join(root, ".tmp", "current-product-demo.vault-snapshot.json");
const now = () => "2026-06-06T18:00:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

await rm(demoPath, { force: true });

const adapter = crypto.createWebCryptoAesGcmAdapter();
const key = await adapter.deriveKey("demo-password", {
  ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  iterations: 20_000,
  saltBase64: toBase64(adapter.randomBytes(16))
});
const encryptFieldValue = crypto.createCryptoFieldEncryptor({
  adapter,
  key,
  aadPrefix: "current-product-demo"
});
const security = new crypto.VaultSecuritySession({
  now,
  autoLockSeconds: 300,
  secondUnlockSeconds: 60,
  copyClearSeconds: 30
});
security.unlock(now());
const criticalBeforeSecondUnlock = security.canRevealField("critical", now());
security.unlockCriticalFields("2026-06-06T18:00:05.000Z");
const copyPlan = security.planClipboardClear("password", "2026-06-06T18:00:10.000Z");

const storage = new desktopStorage.DesktopFileVaultStorageAdapter(demoPath);
const session = await desktopSession.DesktopVaultSession.createNew({
  name: "LoginTo Demo Vault",
  deviceId: "device_desktop_demo",
  storage,
  encryptFieldValueAsync: encryptFieldValue,
  now,
  ids
});

const account = await session.addRecordAsync({
  type: "account",
  title: "GitHub",
  values: {
    username: "demo-user",
    password: "demo-secret",
    url: "https://github.com"
  }
});

const membership = await session.addRecordAsync({
  type: "membership",
  title: "Airport Lounge VIP",
  values: {
    member_name: "Airport Lounge VIP",
    member_id: "LOUNGE-2026",
    expires_at: "2026-12-31T00:00:00.000Z",
    service_phone: "400-555-0101"
  },
  reminderDrafts: [
    {
      dueAt: "2026-12-24T09:00:00.000Z",
      message: "Airport Lounge VIP 7 天后到期",
      daysBefore: 7
    }
  ]
});

const preparedCapture = await mobileCapture.prepareMobileEncryptedCapture({
  adapter,
  key,
  plaintext: new TextEncoder().encode("demo encrypted card photo bytes"),
  mimeType: "image/jpeg",
  source: "camera",
  aadPrefix: "current-product-demo-attachment",
  ids
});

const capture = mobileOcr.startMobileOcrCapture({
  source: "camera",
  imageAttachmentId: preparedCapture.imageAttachmentId,
  image: preparedCapture.image,
  rawText: `Airport Lounge VIP
会员号 LOUNGE-2026
到期 2026-12-31
客服电话 400-555-0101`,
  now,
  ids
});

const ocrRecord = await mobileOcr.commitMobileOcrCaptureAsync({
  repository: session.repository,
  capture,
  decision: {
    draftId: capture.ocrDraft.id,
    acceptedType: "membership",
    acceptedFieldKeys: ["member_name", "member_id", "expires_at", "service_phone"],
    rejectedFieldKeys: [],
    createReminder: true,
    decidedAt: now()
  },
  encryptFieldValue,
  now,
  ids
});

const recordsBeforeSave = session.getRecords();
const reminderCount = recordsBeforeSave.reduce((count, record) => count + record.reminders.length, 0);
const dueAlerts = vault.getDueReminderAlerts(recordsBeforeSave, "2026-12-20T09:00:00.000Z");
const reminderNotificationCenter = new vault.ReminderNotificationCenter([], now);
const dueNotifications = reminderNotificationCenter.collectDue(recordsBeforeSave, "2026-12-20T09:00:00.000Z");
for (const notification of dueNotifications) {
  reminderNotificationCenter.markDelivered(notification.alertId, "2026-12-20T09:01:00.000Z");
}
const notificationsAfterDelivered = reminderNotificationCenter.collectDue(recordsBeforeSave, "2026-12-20T09:02:00.000Z");
reminderNotificationCenter.snooze(
  dueNotifications[0].alertId,
  "2026-12-20T10:00:00.000Z",
  "2026-12-20T09:03:00.000Z"
);
const notificationsAfterSnooze = reminderNotificationCenter.collectDue(recordsBeforeSave, "2026-12-20T10:00:00.000Z");
const reminderNotificationState = reminderNotificationCenter.snapshot("2026-12-20T10:01:00.000Z");
await session.save();

const backupPackage = await vault.createVaultPackageAsync({
  snapshot: session.repository.snapshot(),
  keyPurpose: "backup-package",
  encryptPayload: crypto.createCryptoPackageEncryptor({
    adapter,
    key
  }),
  now,
  ids
});
const restoredBackupSnapshot = await vault.restoreSnapshotFromVaultPackageAsync(
  vault.parseVaultPackage(vault.serializeVaultPackage(backupPackage)),
  crypto.createCryptoPackageDecryptor({
    adapter,
    key
  })
);

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_demo",
  name: "Desktop Demo",
  kind: "desktop",
  publicKeyBase64: "desktop-demo-key",
  now,
  ids
});
const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_demo",
  name: "Phone Demo",
  kind: "phone",
  publicKeyBase64: "phone-demo-key",
  now,
  ids
});

const desktopPairingSession = desktopPairing.createDesktopPairingSession({
  localDevice: desktopDevice,
  localEndpoint: "http://127.0.0.1:43110",
  ttlSeconds: 300,
  now,
  ids
});
const phonePairingSession = mobilePairing.createMobilePairingSession({
  localDevice: phoneDevice,
  localEndpoint: "http://127.0.0.1:43111",
  ttlSeconds: 300,
  now,
  ids
});
const verification = desktopPairingSession.receiveRemotePayload(phonePairingSession.localPayload);
phonePairingSession.receiveRemotePayload(desktopPairingSession.localPayload);
desktopPairingSession.markVerified("2026-06-06T18:01:00.000Z");
phonePairingSession.markVerified("2026-06-06T18:01:00.000Z");

const desktopSync = new sync.NearFieldSyncSession({
  localDevice: desktopDevice
});
const phoneSync = new sync.NearFieldSyncSession({
  localDevice: phoneDevice,
  changes: [
    sync.createSyncChange({
      id: "sync_change_phone_demo_tag",
      entity: "tag",
      entityId: "tag_phone_demo",
      operation: "create",
      deviceId: phoneDevice.id,
      lamport: 1,
      payloadCipher: "encrypted-phone-demo-tag",
      createdAt: "2026-06-06T18:02:00.000Z",
      ids
    })
  ]
});
desktopPairingSession.confirmTrustedDevice(desktopSync.trustedDevices, "2026-06-06T18:03:00.000Z");
phonePairingSession.confirmTrustedDevice(phoneSync.trustedDevices, "2026-06-06T18:03:00.000Z");

const server = await desktopTransport.startDesktopLocalNetworkEndpoint({
  session: desktopSync,
  host: "127.0.0.1",
  port: 0,
  now,
  ids
});

try {
  const transport = new desktopTransport.DesktopLocalNetworkTransportAdapter();
  const exchange = phoneSync.createOutgoingExchangePackage({
    receiverDeviceId: desktopDevice.id,
    now,
    ids
  });
  const syncResponse = await sync.sendNearFieldRequest({
    transport,
    descriptor: server.descriptor,
    route: "/sync/exchange",
    senderDeviceId: phoneDevice.id,
    body: {
      exchangePackage: exchange,
      transport: "local-network"
    },
    now,
    ids
  });

  const report = {
    product: "LoginTo current product demo",
    stage: "M1 core usable, terminal app shell pending",
    vault: {
      name: session.repository.getManifest().name,
      records: session.getRecords().length,
      accountTitle: account.title,
      membershipTitle: membership.title,
      ocrRecordTitle: ocrRecord.title,
      encryptedAttachment: {
        id: preparedCapture.imageAttachmentId,
        size: preparedCapture.image.encryptedSize,
        mimeType: preparedCapture.image.mimeType
      },
      reminders: reminderCount,
      dueReminderPopups: dueAlerts.length,
      reminderNotifications: {
        stateVersion: reminderNotificationState.stateVersion,
        queued: dueNotifications.length,
        afterDelivered: notificationsAfterDelivered.length,
        afterSnooze: notificationsAfterSnooze.length,
        status: notificationsAfterSnooze[0]?.status ?? "none",
        savedDeliveries: reminderNotificationState.deliveries.length
      },
      savedSnapshotPath: demoPath
    },
    crypto: {
      fieldCipherFormat: crypto.FIELD_CIPHER_FORMAT,
      attachmentCipherFormat: crypto.ATTACHMENT_CIPHER_FORMAT,
      fallback: "WebCrypto AES-GCM + PBKDF2-SHA-256"
    },
    security: {
      lockState: security.snapshot(now()).lockState,
      criticalBeforeSecondUnlock: criticalBeforeSecondUnlock.reason,
      copyClearAt: copyPlan.clearAt
    },
    backup: {
      format: backupPackage.format,
      restoredRecords: restoredBackupSnapshot.records.length,
      attachments: backupPackage.attachments.length
    },
    pairing: {
      sixDigitCode: verification.sixDigitCode,
      desktopStatus: desktopPairingSession.status,
      phoneStatus: phonePairingSession.status
    },
    sync: {
      endpoint: server.baseUrl,
      ok: syncResponse.ok,
      appliedChanges: syncResponse.body?.appliedChanges.length ?? 0,
      trustedDevices: desktopSync.trustedDevices.list().length
    }
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  await server.close();
}
