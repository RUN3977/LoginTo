import { rm } from "node:fs/promises";
import { join } from "node:path";

const desktopRuntime = await import("../apps/desktop/src/runtime.ts");
const mobileRuntime = await import("../apps/mobile/src/runtime.ts");
const mobileStorage = await import("../apps/mobile/src/file-vault-storage.ts");
const mobileState = await import("../apps/mobile/src/runtime-state-storage.ts");
const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const root = process.cwd();
const desktopVaultPath = join(root, ".tmp", "runtime-terminal-notifications-desktop.vault-snapshot.json");
const desktopRuntimeStatePath = `${desktopVaultPath}.runtime-state.json`;
const phoneVaultPath = join(root, ".tmp", "runtime-terminal-notifications-phone.vault-snapshot.json");
const phoneRuntimeStatePath = `${phoneVaultPath}.runtime-state.json`;
const now = () => "2026-06-06T20:00:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

for (const path of [desktopVaultPath, desktopRuntimeStatePath, phoneVaultPath, phoneRuntimeStatePath]) {
  await rm(path, { force: true });
  await rm(`${path}.tmp`, { force: true });
}

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_terminal_notifications",
  name: "Terminal Notification Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-terminal-notification-key",
  now,
  ids
});
const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_terminal_notifications",
  name: "Terminal Notification Phone",
  kind: "phone",
  publicKeyBase64: "phone-terminal-notification-key",
  now,
  ids
});

const desktop = await desktopRuntime.createDesktopRuntime({
  vaultPath: desktopVaultPath,
  runtimeStatePath: desktopRuntimeStatePath,
  password: "runtime-terminal-notifications-password",
  vaultName: "Runtime Terminal Notification Desktop Vault",
  localDevice: desktopDevice,
  kdfIterations: 20_000,
  now,
  ids
});

await desktop.addRecord({
  type: "membership",
  title: "Desktop Club",
  values: {
    member_name: "Desktop Club",
    member_id: "DESK-2026",
    expires_at: "2026-07-01T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-07-01T00:00:00.000Z",
      message: "Desktop Club membership expires soon",
      daysBefore: 7
    }
  ]
});

const shownDesktop = [];
const grantedAdapter = {
  async requestPermission() {
    return { status: "granted", canAskAgain: true };
  },
  async showReminder(payload) {
    shownDesktop.push(payload);
    return {
      notificationId: `desktop_${payload.alertId}`,
      shownAt: "2026-06-24T00:01:00.000Z"
    };
  }
};

const desktopDispatches = await desktop.deliverDueTerminalReminderNotifications(
  grantedAdapter,
  "2026-06-24T00:00:00.000Z"
);
if (desktopDispatches.length !== 1 || desktopDispatches[0].status !== "shown") {
  throw new Error("Expected desktop runtime to dispatch one terminal notification");
}
if (desktop.reminderNotifications.list()[0].status !== "delivered") {
  throw new Error("Expected desktop runtime terminal dispatch to mark reminder delivered");
}

const reloadedDesktop = await desktopRuntime.createDesktopRuntime({
  vaultPath: desktopVaultPath,
  runtimeStatePath: desktopRuntimeStatePath,
  password: "runtime-terminal-notifications-password",
  vaultName: "Runtime Terminal Notification Desktop Vault",
  localDevice: desktopDevice,
  kdfIterations: 20_000,
  now,
  ids
});
const desktopAfterReload = await reloadedDesktop.deliverDueTerminalReminderNotifications(
  grantedAdapter,
  "2026-06-24T00:02:00.000Z"
);
if (desktopAfterReload.length !== 0) {
  throw new Error("Expected reloaded desktop runtime to avoid redispatching delivered terminal notification");
}

const phoneVaultStorage = new mobileStorage.MobileFileVaultStorageAdapter(phoneVaultPath);
const phoneRuntimeState = new mobileState.MobileFileRuntimeStateStorageAdapter(phoneRuntimeStatePath);
const phone = await mobileRuntime.createMobileRuntime({
  password: "runtime-terminal-notifications-password",
  vaultName: "Runtime Terminal Notification Phone Vault",
  localDevice: phoneDevice,
  kdfIterations: 20_000,
  runtimeStateStorage: phoneRuntimeState,
  vaultStorage: phoneVaultStorage,
  now,
  ids
});

const phoneDraft = vault.createRecordDraft({
  type: "membership",
  title: "Phone Club",
  values: {
    member_name: "Phone Club",
    member_id: "PHONE-2026",
    expires_at: "2026-08-01T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-08-01T00:00:00.000Z",
      message: "Phone Club membership expires soon",
      daysBefore: 7
    }
  ]
});
phone.repository.insertRecord(vault.createVaultRecord({
  draft: phoneDraft,
  encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
  now,
  ids
}));
await phone.saveVaultState();

const deniedAdapter = {
  async requestPermission() {
    return { status: "denied", canAskAgain: false };
  },
  async showReminder() {
    throw new Error("Denied terminal notification permission should not show reminders");
  }
};

const phoneDenied = await phone.deliverDueTerminalReminderNotifications(
  deniedAdapter,
  "2026-07-25T00:00:00.000Z"
);
if (phoneDenied.length !== 1 || phoneDenied[0].status !== "permission-denied") {
  throw new Error("Expected phone runtime to surface denied terminal notification permission");
}
if (phone.reminderNotifications.list()[0].status !== "pending") {
  throw new Error("Expected denied phone terminal notification to remain pending");
}

const phoneShown = [];
const phoneGrantedAdapter = {
  async requestPermission() {
    return { status: "granted", canAskAgain: true };
  },
  async showReminder(payload) {
    phoneShown.push(payload);
    return {
      notificationId: `phone_${payload.alertId}`,
      shownAt: "2026-07-25T00:02:00.000Z"
    };
  }
};
const phoneShownDispatch = await phone.deliverDueTerminalReminderNotifications(
  phoneGrantedAdapter,
  "2026-07-25T00:01:00.000Z"
);
if (phoneShownDispatch.length !== 1 || phoneShownDispatch[0].status !== "shown") {
  throw new Error("Expected phone runtime to dispatch granted terminal notification after denied attempt");
}

console.log("Runtime terminal notification smoke test passed.");
console.log(
  JSON.stringify(
    {
      desktopDispatch: desktopDispatches[0].status,
      desktopAfterReload: desktopAfterReload.length,
      desktopPayloadActions: shownDesktop[0].actions.map((action) => action.id),
      phoneDenied: phoneDenied[0].status,
      phoneDispatch: phoneShownDispatch[0].status,
      phonePayloadTitle: phoneShown[0].title
    },
    null,
    2
  )
);
