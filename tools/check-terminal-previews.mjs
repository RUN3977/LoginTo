import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const defaultFallbackSpan = Number(process.env.LOGINTO_TERMINAL_FALLBACK_PORTS ?? "50");

const terminals = [
  {
    name: "desktop",
    label: "Desktop",
    requestedPort: Number(process.env.LOGINTO_DESKTOP_PORT ?? "4173"),
    expectedProduct: "LoginTo desktop shell"
  },
  {
    name: "mobile",
    label: "Mobile",
    requestedPort: Number(process.env.LOGINTO_MOBILE_PORT ?? "4177"),
    expectedProduct: "LoginTo mobile shell"
  },
  {
    name: "tablet",
    label: "Tablet",
    requestedPort: Number(process.env.LOGINTO_TABLET_PORT ?? "4178"),
    expectedProduct: "LoginTo tablet shell"
  }
];

export async function checkTerminalPreviews(input = {}) {
  const fallbackSpan = input.fallbackSpan ?? defaultFallbackSpan;
  const timeoutMs = input.timeoutMs ?? 10_000;
  const deadline = Date.now() + timeoutMs;
  const results = [];

  for (const terminal of terminals) {
    const result = await waitForTerminal(terminal, fallbackSpan, deadline);
    results.push(result);
  }

  return {
    ok: results.every((result) => result.ok),
    checkedAt: new Date().toISOString(),
    terminals: results
  };
}

function createCandidatePorts(requestedPort, fallbackSpan) {
  return [
    requestedPort,
    ...Array.from({ length: fallbackSpan }, (_, index) => requestedPort + 100 + index)
  ];
}

async function waitForTerminal(terminal, fallbackSpan, deadline) {
  let lastError = "not-started";
  while (Date.now() < deadline) {
    for (const port of createCandidatePorts(terminal.requestedPort, fallbackSpan)) {
      const probe = await probeTerminal(terminal, port);
      if (probe.ok) {
        return probe;
      }
      lastError = probe.error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return {
    name: terminal.name,
    label: terminal.label,
    ok: false,
    requestedPort: terminal.requestedPort,
    url: `http://127.0.0.1:${terminal.requestedPort}`,
    error: lastError
  };
}

async function probeTerminal(terminal, port) {
  const url = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(`${url}/api/status`, {
      signal: AbortSignal.timeout(1_000)
    });
    if (!response.ok) {
      return createFailedProbe(terminal, port, `status-${response.status}`);
    }
    const status = await response.json();
    if (status.product !== terminal.expectedProduct) {
      return createFailedProbe(terminal, port, `unexpected-product:${status.product ?? "unknown"}`);
    }
    const appStateProbe = await probeTerminalAppState(terminal, url);
    if (!appStateProbe.ok) {
      return createFailedProbe(terminal, port, appStateProbe.error);
    }
    return {
      name: terminal.name,
      label: terminal.label,
      ok: true,
      requestedPort: terminal.requestedPort,
      port,
      status: port === terminal.requestedPort ? "default" : "fallback",
      product: status.product,
      stage: status.stage,
      features: appStateProbe.features,
      url
    };
  } catch (error) {
    return createFailedProbe(terminal, port, error?.code ?? error?.message ?? "unreachable");
  }
}

async function probeTerminalAppState(terminal, url) {
  try {
    const response = await fetch(`${url}/api/app-state`, {
      signal: AbortSignal.timeout(2_000)
    });
    if (!response.ok) {
      return { ok: false, error: `app-state-${response.status}` };
    }
    const appState = await response.json();
    const hasSecurity = Boolean(appState.security?.lockState);
    const hasSyncAuditLog =
      terminal.name === "desktop"
        ? Array.isArray(appState.sync?.recentReceipts)
        : Array.isArray(appState.syncPanel?.recentReceipts);

    if (!hasSecurity) {
      return { ok: false, error: "missing-security-snapshot" };
    }
    if (!hasSyncAuditLog) {
      return { ok: false, error: "missing-sync-audit-log" };
    }

    return { ok: true, features: ["security", "sync-audit-log"] };
  } catch (error) {
    return { ok: false, error: error?.code ?? error?.message ?? "app-state-unreachable" };
  }
}

function createFailedProbe(terminal, port, error) {
  return {
    name: terminal.name,
    label: terminal.label,
    ok: false,
    requestedPort: terminal.requestedPort,
    port,
    url: `http://127.0.0.1:${port}`,
    error
  };
}

function printHumanSummary(report) {
  console.log(report.ok ? "LoginTo preview health check passed." : "LoginTo preview health check failed.");
  for (const terminal of report.terminals) {
    if (terminal.ok) {
      const suffix = terminal.status === "fallback" ? `fallback for ${terminal.requestedPort}` : "default";
      console.log(`- ${terminal.label}: ${terminal.url} (${suffix})`);
    } else {
      console.log(`- ${terminal.label}: not reachable (${terminal.error})`);
    }
  }
}

function printJsonSummary(report) {
  console.log(JSON.stringify(report, null, 2));
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const json = process.argv.includes("--json");
  const report = await checkTerminalPreviews();
  if (json) {
    printJsonSummary(report);
  } else {
    printHumanSummary(report);
  }
  if (!report.ok) {
    process.exit(1);
  }
}
