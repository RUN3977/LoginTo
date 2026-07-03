import { appendFile, mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = normalize(join(__dirname, "..", "..", ".."));
const defaultDispatchLogPath = join(workspaceRoot, ".tmp", "desktop-reminder-notification-dispatches.jsonl");

export function createDesktopReminderNotificationAdapter(input = {}) {
  const dispatchLogPath = input.dispatchLogPath ?? getDesktopReminderNotificationDispatchLogPath();
  const mode = input.mode ?? process.env.LOGINTO_DESKTOP_NOTIFICATION_MODE ?? "windows-toast";
  const now = input.now ?? (() => new Date().toISOString());

  return {
    async requestPermission() {
      if (mode === "unsupported") {
        return { status: "unsupported", canAskAgain: false };
      }
      if (mode === "denied") {
        return { status: "denied", canAskAgain: false };
      }
      return { status: "granted", canAskAgain: true };
    },

    async showReminder(payload) {
      const shownAt = now();
      const notificationId = `desktop_${Buffer.from(payload.alertId).toString("base64url")}`;
      const native = mode === "log-only"
        ? { attempted: false, status: "skipped", reason: "log-only" }
        : await tryShowWindowsToast(payload);
      await appendDispatchLog(dispatchLogPath, {
        notificationId,
        shownAt,
        native,
        payload: sanitizePayload(payload)
      });
      return {
        notificationId,
        shownAt
      };
    }
  };
}

export async function readDesktopReminderNotificationDispatchLog(input = {}) {
  const dispatchLogPath = input.dispatchLogPath ?? getDesktopReminderNotificationDispatchLogPath();
  try {
    const text = await readFile(dispatchLogPath, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function getDesktopReminderNotificationDispatchLogPath() {
  return process.env.LOGINTO_DESKTOP_NOTIFICATION_DISPATCH_LOG_PATH || defaultDispatchLogPath;
}

async function appendDispatchLog(path, event) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
}

function sanitizePayload(payload) {
  return {
    id: payload.id,
    category: payload.category,
    alertId: payload.alertId,
    reminderId: payload.reminderId,
    recordId: payload.recordId,
    recordTitle: payload.recordTitle,
    title: payload.title,
    body: payload.body,
    dueAt: payload.dueAt,
    triggerAt: payload.triggerAt,
    actions: payload.actions.map((action) => action.id)
  };
}

async function tryShowWindowsToast(payload) {
  if (process.platform !== "win32") {
    return { attempted: false, status: "unsupported-platform", platform: process.platform };
  }

  const script = createToastPowerShell(payload);
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], {
      windowsHide: true,
      stdio: "ignore"
    });
    child.on("error", (error) => {
      resolve({ attempted: true, status: "failed", error: error.message });
    });
    child.on("exit", (code) => {
      resolve({ attempted: true, status: code === 0 ? "shown" : "failed", exitCode: code });
    });
  });
}

function createToastPowerShell(payload) {
  const title = escapePowerShellString(payload.title);
  const body = escapePowerShellString(`${payload.recordTitle}: ${payload.body}`);
  return [
    "try {",
    "  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
    "  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null",
    "  $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02",
    "  $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template)",
    "  $texts = $xml.GetElementsByTagName('text')",
    `  $texts.Item(0).AppendChild($xml.CreateTextNode('${title}')) > $null`,
    `  $texts.Item(1).AppendChild($xml.CreateTextNode('${body}')) > $null`,
    "  $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
    "  $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('LoginTo')",
    "  $notifier.Show($toast)",
    "  exit 0",
    "} catch {",
    "  exit 2",
    "}"
  ].join("; ");
}

function escapePowerShellString(value) {
  return String(value).replaceAll("'", "''").replace(/[\r\n]+/g, " ");
}
