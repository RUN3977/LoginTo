import { access, mkdir, open } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const nodePath = join(root, ".toolchain", "node-v24.16.0-win-x64", "node.exe");
const logDir = join(root, ".tmp");
const outLog = join(logDir, "desktop-native-shell.out.log");
const errLog = join(logDir, "desktop-native-shell.err.log");
const requestedPort = Number(process.env.LOGINTO_DESKTOP_PORT ?? "4173");
const defaultTimeoutMs = 10_000;

export async function startDesktopNativeShell(input = {}) {
  const shouldOpen = input.open ?? !process.argv.includes("--no-open");
  const timeoutMs = input.timeoutMs ?? defaultTimeoutMs;

  await ensureDesktopServerStarted();
  const desktop = await waitForDesktopShell(requestedPort, timeoutMs);
  if (!desktop.ok) {
    throw new Error(`Desktop shell is not reachable: ${desktop.error}`);
  }

  let appWindow;
  if (shouldOpen) {
    appWindow = await openDesktopAppWindow(desktop.url);
  }

  return {
    ok: true,
    url: desktop.url,
    port: desktop.port,
    product: desktop.product,
    stage: desktop.stage,
    appWindow,
    logs: {
      out: resolve(outLog),
      err: resolve(errLog)
    }
  };
}

async function ensureDesktopServerStarted() {
  const existing = await probeDesktopShell(requestedPort);
  if (existing.ok) {
    return existing;
  }

  await mkdir(logDir, { recursive: true });
  const outHandle = await open(outLog, "a");
  const errHandle = await open(errLog, "a");
  const child = spawn(nodePath, ["apps/desktop/scripts/dev-server.mjs"], {
    cwd: root,
    detached: true,
    stdio: ["ignore", outHandle.fd, errHandle.fd],
    windowsHide: true,
    env: createChildEnv()
  });
  child.unref();
  await outHandle.close();
  await errHandle.close();
  return {
    ok: true,
    startedPid: child.pid
  };
}

async function waitForDesktopShell(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastProbe = { ok: false, error: "not-started" };
  while (Date.now() < deadline) {
    lastProbe = await probeDesktopShell(port);
    if (lastProbe.ok) {
      return lastProbe;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return lastProbe;
}

async function probeDesktopShell(port) {
  const url = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(`${url}/api/status`, {
      signal: AbortSignal.timeout(1_000)
    });
    if (!response.ok) {
      return { ok: false, url, port, error: `status-${response.status}` };
    }
    const status = await response.json();
    if (status.product !== "LoginTo desktop shell") {
      return { ok: false, url, port, error: `unexpected-product:${status.product ?? "unknown"}` };
    }
    return {
      ok: true,
      url,
      port,
      product: status.product,
      stage: status.stage
    };
  } catch (error) {
    return {
      ok: false,
      url,
      port,
      error: error?.code ?? error?.message ?? "unreachable"
    };
  }
}

async function openDesktopAppWindow(url) {
  const browserPath = await findAppModeBrowser();
  if (!browserPath) {
    return {
      opened: false,
      reason: "No Edge or Chrome executable found"
    };
  }

  const child = spawn(browserPath, [
    `--app=${url}`,
    "--new-window",
    "--disable-features=Translate"
  ], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();
  return {
    opened: true,
    browserPath,
    pid: child.pid
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

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createChildEnv() {
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "path")
  );
  return {
    ...baseEnv,
    Path: [
      join(root, ".toolchain", "node-v24.16.0-win-x64"),
      process.env.PATH ?? process.env.Path ?? ""
    ].join(";"),
    LOGINTO_DESKTOP_PORT: String(requestedPort)
  };
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  try {
    const result = await startDesktopNativeShell();
    console.log("LoginTo desktop native shell is ready.");
    console.log(`Desktop app URL: ${result.url}`);
    console.log(`Window opened: ${result.appWindow?.opened ? "yes" : process.argv.includes("--no-open") ? "skipped" : "no"}`);
    if (result.appWindow?.reason) {
      console.log(`Window note: ${result.appWindow.reason}`);
    }
    console.log(`Output log: ${result.logs.out}`);
    console.log(`Error log:  ${result.logs.err}`);
  } catch (error) {
    console.error("LoginTo desktop native shell failed.");
    console.error(error.message);
    process.exit(1);
  }
}
