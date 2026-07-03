import { rm } from "node:fs/promises";
import { join } from "node:path";

const desktopRuntime = await import("../apps/desktop/src/runtime.ts");
const mobileRuntime = await import("../apps/mobile/src/runtime.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const root = process.cwd();
const vaultPath = join(root, ".tmp", "runtime-reminder-notifications.vault-snapshot.json");
const runtimeStatePath = `${vaultPath}.runtime-state.json`;
const now = () => "2026-06-06T18:45:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

await rm(vaultPath, { force: true });
await rm(runtimeStatePath, { force: true });

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_reminder_runtime",
  name: "Reminder Runtime Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-reminder-runtime-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_reminder_runtime",
  name: "Reminder Runtime Phone",
  kind: "phone",
  publicKeyBase64: "phone-reminder-runtime-key",
  now,
  ids
});

const desktop = await desktopRuntime.createDesktopRuntime({
  vaultPath,
  runtimeStatePath,
  password: "runtime-reminder-password",
  vaultName: "Runtime Reminder Desktop Vault",
  localDevice: desktopDevice,
  kdfIterations: 20_000,
  now,
  ids
});

const phone = await mobileRuntime.createMobileRuntime({
  password: "runtime-reminder-password",
  vaultName: "Runtime Reminder Phone Vault",
  localDevice: phoneDevice,
  kdfIterations: 20_000,
  now,
  ids
});

await desktop.addRecord({
  type: "membership",
  title: "Reminder Club",
  values: {
    member_name: "Reminder Club",
    member_id: "REM-2026",
    expires_at: "2026-07-01T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-07-01T00:00:00.000Z",
      message: "Reminder Club membership expires soon",
      daysBefore: 7
    }
  ]
});

const desktopDue = await desktop.collectDueReminderNotifications("2026-06-24T00:00:00.000Z");
if (desktopDue.length !== 1) {
  throw new Error("Expected desktop runtime to collect one reminder notification");
}

await desktop.markReminderNotificationDelivered(desktopDue[0].alertId, "2026-06-24T00:01:00.000Z");
const desktopAfterDelivered = await desktop.collectDueReminderNotifications("2026-06-24T00:02:00.000Z");
if (desktopAfterDelivered.length !== 0) {
  throw new Error("Expected desktop runtime to dedupe delivered notification");
}

await desktop.snoozeReminderNotification(
  desktopDue[0].alertId,
  "2026-06-24T01:00:00.000Z",
  "2026-06-24T00:03:00.000Z"
);
const desktopAfterSnooze = await desktop.collectDueReminderNotifications("2026-06-24T01:00:00.000Z");
if (desktopAfterSnooze.length !== 1) {
  throw new Error("Expected desktop runtime to reopen snoozed notification");
}
await desktop.completeReminderNotification(desktopDue[0].alertId, "2026-06-24T01:05:00.000Z");

const preparedCapture = await phone.prepareEncryptedCapture({
  plaintext: new TextEncoder().encode("runtime reminder member card image bytes"),
  mimeType: "image/jpeg",
  source: "camera",
  aadPrefix: "runtime-reminder-attachment"
});

const capture = phone.startOcrCapture({
  source: "camera",
  imageAttachmentId: preparedCapture.imageAttachmentId,
  image: preparedCapture.image,
  rawText: `Reminder Gym
Member ID REM-GYM-2026
Expires 2026-12-31
Service phone 400-555-0199`
});

await phone.commitOcrCapture({
  capture,
  decision: {
    draftId: capture.ocrDraft.id,
    acceptedType: "membership",
    acceptedFieldKeys: ["member_name", "member_id", "expires_at", "service_phone"],
    rejectedFieldKeys: [],
    createReminder: true,
    decidedAt: now()
  }
});

const phoneDue = await phone.collectDueReminderNotifications("2026-12-31T00:00:00.000Z");
if (phoneDue.length !== 1) {
  throw new Error("Expected mobile runtime to collect one reminder notification");
}
await phone.dismissReminderNotification(phoneDue[0].alertId, "2026-12-31T00:01:00.000Z");
const phoneAfterDismiss = await phone.collectDueReminderNotifications("2026-12-31T01:00:00.000Z");
if (phoneAfterDismiss.length !== 0) {
  throw new Error("Expected mobile runtime to dedupe dismissed notification");
}

console.log("Runtime reminder notification smoke test passed.");
console.log(
  JSON.stringify(
    {
      desktopAlertId: desktopDue[0].alertId,
      desktopFinalStatus: desktop.reminderNotifications.list()[0].status,
      mobileAlertId: phoneDue[0].alertId,
      mobileFinalStatus: phone.reminderNotifications.list()[0].status,
      desktopReopenedAfterSnooze: desktopAfterSnooze.length,
      phoneAttachmentSize: preparedCapture.image.encryptedSize
    },
    null,
    2
  )
);
