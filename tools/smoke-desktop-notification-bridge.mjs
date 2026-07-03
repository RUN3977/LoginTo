import { rm } from "node:fs/promises";
import { join } from "node:path";

const desktopAppState = await import("../apps/desktop/scripts/app-state.mjs");
const notificationBridge = await import("../apps/desktop/scripts/notification-bridge.mjs");

const root = process.cwd();
const vaultPath = join(root, ".tmp", "desktop-notification-bridge.vault-snapshot.json");
const runtimeStatePath = join(root, ".tmp", "desktop-notification-bridge.runtime-state.json");
const deviceIdentityPath = join(root, ".tmp", "desktop-notification-bridge.device-identity.json");
const dispatchLogPath = join(root, ".tmp", "desktop-notification-bridge.dispatches.jsonl");

for (const path of [vaultPath, runtimeStatePath, deviceIdentityPath, dispatchLogPath]) {
  await rm(path, { force: true });
  await rm(`${path}.tmp`, { force: true });
}

const first = await desktopAppState.dispatchDesktopShellReminderNotifications({
  vaultPath,
  runtimeStatePath,
  deviceIdentityPath,
  dispatchLogPath,
  mode: "log-only",
  dispatchedAt: "2026-12-20T09:00:00.000Z"
});

if (!first.ok || first.dispatches.length < 1) {
  throw new Error("Expected desktop notification bridge to dispatch at least one due reminder");
}
if (!first.dispatches.every((dispatch) => dispatch.status === "shown")) {
  throw new Error("Expected desktop notification bridge dispatches to be shown");
}

const log = await notificationBridge.readDesktopReminderNotificationDispatchLog({ dispatchLogPath });
if (log.length !== first.dispatches.length) {
  throw new Error("Expected desktop notification bridge to write one log event per dispatch");
}
if (log[0].native.status !== "skipped" || log[0].payload.category !== "reminder") {
  throw new Error("Expected log-only bridge to preserve reminder payloads");
}

const second = await desktopAppState.dispatchDesktopShellReminderNotifications({
  vaultPath,
  runtimeStatePath,
  deviceIdentityPath,
  dispatchLogPath,
  mode: "log-only",
  dispatchedAt: "2026-12-20T09:02:00.000Z"
});

if (second.dispatches.length !== 0) {
  throw new Error("Expected delivered desktop reminders not to redispatch");
}
if (second.appState.notificationBridge.dispatched !== log.length) {
  throw new Error("Expected app-state to expose desktop notification bridge dispatch count");
}

console.log("Desktop notification bridge smoke test passed.");
console.log(
  JSON.stringify(
    {
      dispatches: first.dispatches.length,
      redispatches: second.dispatches.length,
      dispatchLogPath,
      firstStatus: first.dispatches[0].status,
      bridgeStatus: second.appState.notificationBridge.status
    },
    null,
    2
  )
);
