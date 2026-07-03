import { rm } from "node:fs/promises";
import { join } from "node:path";

const desktopRuntime = await import("../apps/desktop/src/runtime.ts");
const sync = await import("../packages/sync-core/src/index.ts");
const vault = await import("../packages/vault-core/src/index.ts");

const root = process.cwd();
const sourcePath = join(root, ".tmp", "desktop-backup-source.vault-snapshot.json");
const restoredPath = join(root, ".tmp", "desktop-backup-restored.vault-snapshot.json");
const fixedNow = () => "2026-06-06T20:10:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

await rm(sourcePath, { force: true });
await rm(restoredPath, { force: true });

const device = sync.createDeviceIdentity({
  id: "device_desktop_backup",
  name: "Backup Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-backup-key",
  now: fixedNow,
  ids
});

const source = await desktopRuntime.createDesktopRuntime({
  vaultPath: sourcePath,
  password: "backup-password",
  vaultName: "Backup Source Vault",
  localDevice: device,
  saltBase64: "YmFja3VwLXNhbHQtMTIzNDU2",
  kdfIterations: 20_000,
  now: fixedNow,
  ids
});

const record = await source.addRecord({
  type: "bank_card",
  title: "Travel Card",
  values: {
    bank_name: "Travel Bank",
    cardholder: "Demo User",
    card_number: "4111111111111111",
    expiry_date: "2027-01-31T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2027-01-24T09:00:00.000Z",
      message: "Travel Card 7 天后到期",
      daysBefore: 7
    }
  ]
});
const attachment = vault.createAttachmentRef({
  id: "attachment_backup_travel_card_photo",
  recordId: record.id,
  encryptedBlobPath: "attachments/backup-travel-card-photo.blob",
  mimeType: "image/jpeg",
  digest: "sha256-backup-travel-card-photo",
  encryptedSize: 4096,
  source: "camera",
  now: fixedNow,
  ids
});
source.session.addAttachment(record.id, attachment);
await source.session.save();

const backupPackage = await source.exportEncryptedBackupPackage();
const backupJson = source.serializeEncryptedBackupPackage(backupPackage);

const restored = await desktopRuntime.restoreDesktopRuntimeFromEncryptedBackup({
  vaultPath: restoredPath,
  packageJson: backupJson,
  password: "backup-password",
  vaultName: "Restored Vault",
  localDevice: device,
  saltBase64: source.cryptoState.kdfParams.saltBase64,
  kdfIterations: 20_000,
  now: fixedNow,
  ids
});

if (restored.session.getRecords().length !== 1) {
  throw new Error(`Expected 1 restored record, got ${restored.session.getRecords().length}`);
}
const restoredRecord = restored.session.getRecords()[0];
if (
  backupPackage.attachments.length !== 1
  || backupPackage.attachments[0].id !== attachment.id
  || backupPackage.attachments[0].sourcePath !== attachment.encryptedBlobPath
  || restoredRecord.attachments.length !== 1
  || restoredRecord.attachments[0].id !== attachment.id
) {
  throw new Error(`Expected backup package and restored record to retain encrypted attachment metadata: ${JSON.stringify({
    packageAttachments: backupPackage.attachments,
    restoredAttachments: restoredRecord.attachments
  })}`);
}

if (restored.getDueReminderPopups("2027-01-24T09:00:00.000Z").length !== 1) {
  throw new Error("Expected restored reminder to produce due popup");
}

let rejectedWrongPassword = false;
try {
  await desktopRuntime.restoreDesktopRuntimeFromEncryptedBackup({
    vaultPath: restoredPath,
    packageJson: backupJson,
    password: "wrong-password",
    vaultName: "Wrong Password",
    localDevice: device,
    saltBase64: source.cryptoState.kdfParams.saltBase64,
    kdfIterations: 20_000,
    now: fixedNow,
    ids
  });
} catch {
  rejectedWrongPassword = true;
}

if (!rejectedWrongPassword) {
  throw new Error("Expected wrong backup password to reject restore");
}

console.log("Desktop backup restore smoke test passed.");
console.log(
  JSON.stringify(
    {
      packageFormat: backupPackage.format,
      packageRecords: restored.session.getRecords().length,
      attachments: backupPackage.attachments.length,
      dueReminders: restored.getDueReminderPopups("2027-01-24T09:00:00.000Z").length,
      rejectedWrongPassword
    },
    null,
    2
  )
);
