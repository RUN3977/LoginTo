import { rm } from "node:fs/promises";
import { join } from "node:path";

const desktopRuntime = await import("../apps/desktop/src/runtime.ts");
const runtimeState = await import("../apps/desktop/src/runtime-state-storage.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const root = process.cwd();
const vaultPath = join(root, ".tmp", "desktop-reminder-state.vault-snapshot.json");
const statePath = join(root, ".tmp", "desktop-reminder-state.runtime-state.json");
const now = () => "2026-06-06T18:50:00.000Z";
const saltBase64 = Buffer.alloc(16).toString("base64");
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

await rm(vaultPath, { force: true });
await rm(statePath, { force: true });

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_reminder_state",
  name: "Reminder State Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-reminder-state-key",
  now,
  ids
});

const desktop = await desktopRuntime.createDesktopRuntime({
  vaultPath,
  runtimeStatePath: statePath,
  password: "runtime-state-password",
  saltBase64,
  vaultName: "Runtime State Vault",
  localDevice: desktopDevice,
  kdfIterations: 20_000,
  now,
  ids
});

await desktop.addRecord({
  type: "membership",
  title: "Reload Club",
  values: {
    member_name: "Reload Club",
    member_id: "RELOAD-2026",
    expires_at: "2026-07-01T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-07-01T00:00:00.000Z",
      message: "Reload Club membership expires soon",
      daysBefore: 7
    }
  ]
});

const due = await desktop.collectDueReminderNotifications("2026-06-24T00:00:00.000Z");
if (due.length !== 1) {
  throw new Error("Expected first runtime to collect one due notification");
}

await desktop.markReminderNotificationDelivered(due[0].alertId, "2026-06-24T00:01:00.000Z");

const storage = new runtimeState.DesktopFileRuntimeStateStorageAdapter(statePath);
const savedState = await storage.load();
if (!savedState || savedState.reminderNotifications.deliveries[0]?.status !== "delivered") {
  throw new Error("Expected delivered notification state to be saved");
}

const reloaded = await desktopRuntime.createDesktopRuntime({
  vaultPath,
  runtimeStatePath: statePath,
  password: "runtime-state-password",
  saltBase64,
  vaultName: "Runtime State Vault",
  localDevice: desktopDevice,
  kdfIterations: 20_000,
  now,
  ids
});

const afterReload = await reloaded.collectDueReminderNotifications("2026-06-24T00:02:00.000Z");
if (afterReload.length !== 0) {
  throw new Error("Expected reloaded runtime to dedupe delivered notification");
}

const reloadedState = await storage.load();
if (!reloadedState || reloadedState.reminderNotifications.deliveries[0]?.alertId !== due[0].alertId) {
  throw new Error("Expected reloaded state to keep stable alert id");
}

console.log("Desktop reminder notification state smoke test passed.");
console.log(
  JSON.stringify(
    {
      statePath,
      alertId: due[0].alertId,
      savedStatus: savedState.reminderNotifications.deliveries[0].status,
      afterReload: afterReload.length,
      runtimeStateVersion: reloadedState.runtimeStateVersion
    },
    null,
    2
  )
);
