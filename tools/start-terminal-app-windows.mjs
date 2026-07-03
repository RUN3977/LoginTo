import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { startTerminalPreviews, stopTerminalPreviews } from "./start-terminal-previews.mjs";

const root = process.cwd();

const appWindowProfiles = {
  desktop: {
    title: "LoginTo Desktop",
    product: "LoginTo desktop shell",
    size: "1320,900"
  },
  mobile: {
    title: "LoginTo Phone",
    product: "LoginTo mobile shell",
    size: "430,860"
  },
  tablet: {
    title: "LoginTo Tablet",
    product: "LoginTo tablet shell",
    size: "1180,820"
  }
};

export async function startTerminalAppWindows(input = {}) {
  const shouldOpen = input.open ?? !process.argv.includes("--no-open");
  const selectedTerminals = normalizeSelectedTerminals(input.terminals ?? parseTerminalArgs(process.argv));
  const previews = await startTerminalPreviews({
    open: false,
    print: input.printPreviews ?? false,
    ports: input.ports,
    fallbackSpan: input.fallbackSpan
  });
  const browserPath = shouldOpen ? await findAppModeBrowser() : undefined;
  const terminals = [];

  for (const terminal of previews.terminals.filter((item) => selectedTerminals.includes(item.name))) {
    const profile = appWindowProfiles[terminal.name];
    const status = await verifyTerminalProduct(terminal.url, profile.product, input.timeoutMs ?? 10_000);
    const appWindow = shouldOpen
      ? await openTerminalAppWindow({
        browserPath,
        terminal,
        profile
      })
      : { opened: false, skipped: true };
    terminals.push({
      ...terminal,
      product: status.product,
      stage: status.stage,
      appWindow
    });
  }

  return {
    ok: terminals.every((terminal) => terminal.product === appWindowProfiles[terminal.name].product),
    previews,
    selectedTerminals,
    terminals,
    browserPath
  };
}

export async function stopTerminalAppWindows(result) {
  await stopTerminalPreviews(result?.previews);
}

async function verifyTerminalProduct(url, expectedProduct, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "not-started";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/status`, {
        signal: AbortSignal.timeout(1_000)
      });
      if (response.ok) {
        const status = await response.json();
        if (status.product === expectedProduct) {
          return status;
        }
        lastError = `unexpected-product:${status.product ?? "unknown"}`;
      } else {
        lastError = `status-${response.status}`;
      }
    } catch (error) {
      lastError = error?.code ?? error?.message ?? "unreachable";
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${expectedProduct} is not reachable at ${url}: ${lastError}`);
}

async function openTerminalAppWindow(input) {
  if (!input.browserPath) {
    return {
      opened: false,
      reason: "No Edge or Chrome executable found"
    };
  }
  const userDataDir = join(root, ".tmp", `app-window-${input.terminal.name}`);
  const child = spawn(input.browserPath, [
    `--app=${input.terminal.url}`,
    "--new-window",
    `--window-size=${input.profile.size}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-features=Translate",
    `--class=${input.profile.title}`
  ], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();
  return {
    opened: true,
    browserPath: input.browserPath,
    pid: child.pid,
    title: input.profile.title,
    size: input.profile.size
  };
}

async function findAppModeBrowser() {
  const candidates = [
    process.env.LOGINTO_BROWSER_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function normalizeSelectedTerminals(terminals) {
  const values = Array.isArray(terminals) && terminals.length ? terminals : Object.keys(appWindowProfiles);
  const normalized = [...new Set(values.map((terminal) => String(terminal).trim().toLowerCase()).filter(Boolean))];
  for (const terminal of normalized) {
    if (!appWindowProfiles[terminal]) {
      throw new Error(`Unknown LoginTo terminal app window: ${terminal}`);
    }
  }
  return normalized;
}

function parseTerminalArgs(argv) {
  const selected = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--terminal" || arg === "--only") {
      selected.push(...String(argv[index + 1] ?? "").split(","));
      index += 1;
      continue;
    }
    if (arg.startsWith("--terminal=")) {
      selected.push(...arg.slice("--terminal=".length).split(","));
      continue;
    }
    if (arg.startsWith("--only=")) {
      selected.push(...arg.slice("--only=".length).split(","));
    }
  }
  return selected;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function printAppWindowSummary(result) {
  console.log("LoginTo terminal app windows are ready:");
  for (const terminal of result.terminals) {
    const windowState = terminal.appWindow.opened
      ? `window pid ${terminal.appWindow.pid}`
      : terminal.appWindow.skipped
        ? "window skipped"
        : `window not opened: ${terminal.appWindow.reason}`;
    console.log(`- ${terminal.name}: ${terminal.url} (${windowState})`);
  }
  console.log("Keep this terminal open while using LoginTo.");
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const result = await startTerminalAppWindows();
  printAppWindowSummary(result);

  const stopAll = async () => {
    await stopTerminalAppWindows(result);
  };

  process.on("SIGINT", async () => {
    await stopAll();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await stopAll();
    process.exit(0);
  });
}
