import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDesktopShellServer } from "../apps/desktop/scripts/dev-server.mjs";
import { createMobileShellServer } from "../apps/mobile/scripts/dev-server.mjs";
import { createTabletShellServer } from "../apps/tablet/scripts/dev-server.mjs";

const defaultFallbackSpan = Number(process.env.LOGINTO_TERMINAL_FALLBACK_PORTS ?? "50");

export async function startTerminalPreviews(input = {}) {
  const shouldOpen = input.open ?? false;
  const fallbackSpan = input.fallbackSpan ?? defaultFallbackSpan;
  const terminals = createTerminalConfigs(input.ports ?? {});
  const launched = [];

  try {
    for (const terminal of terminals) {
      launched.push(await startOrReuseTerminal(terminal, fallbackSpan));
    }
  } catch (error) {
    await stopTerminalPreviews({ terminals: launched });
    throw error;
  }

  if (input.print !== false) {
    printPreviewSummary(launched);
  }

  if (shouldOpen) {
    for (const terminal of launched) {
      openBrowser(terminal.url);
    }
  }

  return { terminals: launched };
}

export async function stopTerminalPreviews(previews) {
  const terminals = previews?.terminals ?? [];
  await Promise.all(terminals.filter((terminal) => terminal.server).map((terminal) => closeServer(terminal.server)));
}

function createTerminalConfigs(ports) {
  return [
    {
      name: "desktop",
      requestedPort: Number(ports.desktop ?? process.env.LOGINTO_DESKTOP_PORT ?? "4173"),
      expectedProduct: "LoginTo desktop shell",
      createServer: createDesktopShellServer
    },
    {
      name: "mobile",
      requestedPort: Number(ports.mobile ?? process.env.LOGINTO_MOBILE_PORT ?? "4177"),
      expectedProduct: "LoginTo mobile shell",
      createServer: createMobileShellServer
    },
    {
      name: "tablet",
      requestedPort: Number(ports.tablet ?? process.env.LOGINTO_TABLET_PORT ?? "4178"),
      expectedProduct: "LoginTo tablet shell",
      createServer: createTabletShellServer
    }
  ];
}

async function startOrReuseTerminal(terminal, fallbackSpan) {
  const requested = await tryStartServer(terminal, terminal.requestedPort);
  if (requested.started) {
    return createStartedTerminal(terminal, terminal.requestedPort, requested.server, "started");
  }

  if (!isPortInUse(requested.error)) {
    throw requested.error;
  }

  if (await isExpectedExistingPreview(terminal, terminal.requestedPort)) {
    return createStartedTerminal(terminal, terminal.requestedPort, undefined, "reused");
  }

  const firstFallbackPort = terminal.requestedPort + 100;
  for (let offset = 0; offset < fallbackSpan; offset += 1) {
    const port = firstFallbackPort + offset;
    const fallback = await tryStartServer(terminal, port);
    if (fallback.started) {
      return createStartedTerminal(terminal, port, fallback.server, "fallback");
    }
    if (!isPortInUse(fallback.error)) {
      throw fallback.error;
    }
  }

  throw new Error(
    `${terminal.name} preview port ${terminal.requestedPort} is occupied by another service, and no fallback port was available`
  );
}

function createStartedTerminal(terminal, port, server, status) {
  return {
    name: terminal.name,
    port,
    requestedPort: terminal.requestedPort,
    expectedProduct: terminal.expectedProduct,
    server,
    status,
    url: `http://127.0.0.1:${port}`
  };
}

async function tryStartServer(terminal, port) {
  const server = terminal.createServer();
  try {
    await listen(server, port);
    return { started: true, server };
  } catch (error) {
    await closeServer(server);
    return { started: false, error };
  }
}

function listen(server, port) {
  return new Promise((resolveListen, rejectListen) => {
    const rejectOnce = (error) => {
      server.off("listening", resolveOnce);
      rejectListen(error);
    };
    const resolveOnce = () => {
      server.off("error", rejectOnce);
      resolveListen();
    };
    server.once("error", rejectOnce);
    server.once("listening", resolveOnce);
    server.listen(port, "127.0.0.1");
  });
}

async function isExpectedExistingPreview(terminal, port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
      signal: AbortSignal.timeout(1_000)
    });
    if (!response.ok) {
      return false;
    }
    const status = await response.json();
    return status.product === terminal.expectedProduct && (await isExpectedExistingAppState(terminal, port));
  } catch {
    return false;
  }
}

async function isExpectedExistingAppState(terminal, port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/app-state`, {
      signal: AbortSignal.timeout(2_000)
    });
    if (!response.ok) {
      return false;
    }
    const appState = await response.json();
    const hasSecurity = Boolean(appState.security?.lockState);
    const hasSyncAuditLog =
      terminal.name === "desktop"
        ? Array.isArray(appState.sync?.recentReceipts)
        : Array.isArray(appState.syncPanel?.recentReceipts);
    return hasSecurity && hasSyncAuditLog;
  } catch {
    return false;
  }
}

function isPortInUse(error) {
  return error?.code === "EADDRINUSE";
}

function printPreviewSummary(terminals) {
  console.log("LoginTo terminal previews running:");
  for (const terminal of terminals) {
    const suffix =
      terminal.status === "fallback"
        ? `${terminal.status}; requested ${terminal.requestedPort}`
        : terminal.status;
    console.log(`- ${terminal.name}: ${terminal.url} (${suffix})`);
  }

  if (terminals.some((terminal) => terminal.server)) {
    console.log("Press Ctrl+C to stop preview servers started by this process.");
  }
}

function closeServer(server) {
  return new Promise((resolveClose) => {
    if (!server.listening) {
      resolveClose();
      return;
    }
    server.close(() => resolveClose());
  });
}

function openBrowser(url) {
  const child = spawn("cmd", ["/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}

function isMainModule() {
  return process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMainModule()) {
  const shouldOpen = process.argv.includes("--open");
  let previews;
  const keepAlive = setInterval(() => {}, 60_000);

  try {
    previews = await startTerminalPreviews({ open: shouldOpen });
  } catch (error) {
    clearInterval(keepAlive);
    console.error(`Unable to start terminal previews: ${error.message}`);
    process.exit(1);
  }

  const stopAll = async () => {
    clearInterval(keepAlive);
    await stopTerminalPreviews(previews);
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
