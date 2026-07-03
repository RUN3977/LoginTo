import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import {
  applyDesktopShellReminderAction,
  actOnDesktopShellSyncConfirmation,
  confirmDesktopShellPairing,
  createDesktopShellAppState,
  createDesktopShellNearFieldDiscovery,
  dispatchDesktopShellReminderNotifications,
  exportDesktopShellBackupPackage,
  createDesktopShellRecord,
  createDesktopShellPairingPreview,
  createDesktopShellSyncPreview,
  deleteDesktopShellRecord,
  getDesktopShellSyncSummary,
  pushDesktopShellSyncToTerminal,
  receiveDesktopShellSyncPackage,
  receiveDesktopShellSyncRequest,
  receiveDesktopShellSyncRequestResult,
  removeDesktopShellAttachment,
  resolveDesktopShellDiscoveryCandidateAction,
  revokeDesktopShellTrustedDevice,
  simulateDesktopShellSyncFailure,
  updateDesktopShellRecord,
  verifyDesktopShellBackupPackage,
  revealDesktopShellFields
} from "./app-state.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const desktopRoot = normalize(join(__dirname, ".."));
const workspaceRoot = normalize(join(desktopRoot, "..", ".."));
const publicRoot = join(desktopRoot, "prototype");
const shouldOpen = process.argv.includes("--open");
const requestedPort = Number(process.env.LOGINTO_DESKTOP_PORT ?? "0");

const mimeByExt = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"]
]);

if (isMainModule()) {
  const server = createDesktopShellServer();
  server.listen(requestedPort, "127.0.0.1", () => {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}`;
    console.log(`LoginTo desktop shell running at ${url}`);
    console.log(`Status endpoint: ${url}/api/status`);
    if (shouldOpen) {
      openBrowser(url);
    }
  });
}

export function createDesktopShellServer() {
  return createServer(async (request, response) => {
    try {
      setLocalCorsHeaders(response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/api/status") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(createStatusPayload(), null, 2));
        return;
      }
      if (url.pathname === "/api/app-state") {
        const appState = await createDesktopShellAppState();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(appState, null, 2));
        return;
      }
      if (url.pathname === "/api/discovery/scan" && request.method === "POST") {
        const body = await readJsonBody(request);
        const discovery = await createDesktopShellNearFieldDiscovery(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, discovery }, null, 2));
        return;
      }
      if (url.pathname === "/api/discovery/resolve" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await resolveDesktopShellDiscoveryCandidateAction(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/backup/export" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await exportDesktopShellBackupPackage(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/backup/verify" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await verifyDesktopShellBackupPackage(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/reminders/action" && request.method === "POST") {
        const body = await readJsonBody(request);
        const appState = await applyDesktopShellReminderAction(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(appState, null, 2));
        return;
      }
      if (url.pathname === "/api/reminders/dispatch" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await dispatchDesktopShellReminderNotifications(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "POST") {
        const body = await readJsonBody(request);
        const appState = await createDesktopShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(appState, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "PATCH") {
        const body = await readJsonBody(request);
        const appState = await updateDesktopShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(appState, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const appState = await deleteDesktopShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(appState, null, 2));
        return;
      }
      if (url.pathname === "/api/attachments" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const result = await removeDesktopShellAttachment(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/fields/reveal" && request.method === "POST") {
        const body = await readJsonBody(request);
        const revealResult = await revealDesktopShellFields(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(revealResult, null, 2));
        return;
      }
      if (url.pathname === "/api/pairing/start" && request.method === "POST") {
        const body = await readJsonBody(request);
        const pairingPreview = await createDesktopShellPairingPreview({
          localEndpoint: createRequestBaseUrl(request),
          ...body
        });
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(pairingPreview, null, 2));
        return;
      }
      if (url.pathname === "/api/pairing/confirm" && request.method === "POST") {
        const body = await readJsonBody(request);
        const pairingResult = await confirmDesktopShellPairing(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(pairingResult, null, 2));
        return;
      }
      if (url.pathname === "/api/trusted-devices" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const result = await revokeDesktopShellTrustedDevice(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/receive" && request.method === "POST") {
        const body = await readJsonBody(request);
        const syncResult = await receiveDesktopShellSyncPackage(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(syncResult, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/request" && request.method === "POST") {
        const body = await readJsonBody(request);
        const syncResult = await receiveDesktopShellSyncRequest(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(syncResult, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/request-result" && request.method === "POST") {
        const body = await readJsonBody(request);
        const syncResult = await receiveDesktopShellSyncRequestResult(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(syncResult, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/summary") {
        const syncSummary = await getDesktopShellSyncSummary();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(syncSummary, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/preview" && request.method === "POST") {
        const body = await readJsonBody(request);
        const syncPreview = await createDesktopShellSyncPreview(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(syncPreview, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/push" && request.method === "POST") {
        const body = await readJsonBody(request);
        const syncResult = await pushDesktopShellSyncToTerminal(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(syncResult, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/demo-failure" && request.method === "POST") {
        const body = await readJsonBody(request);
        const syncResult = await simulateDesktopShellSyncFailure(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(syncResult, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/confirmation-action" && request.method === "POST") {
        const body = await readJsonBody(request);
        const syncResult = await actOnDesktopShellSyncConfirmation(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(syncResult, null, 2));
        return;
      }
      if (url.pathname === "/api/reminders/action") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/discovery/scan") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/reminders/dispatch") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/backup/export" || url.pathname === "/api/backup/verify") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/records") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/fields/reveal") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/pairing/start") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/pairing/confirm") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/trusted-devices") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/sync/receive" || url.pathname === "/api/sync/request" || url.pathname === "/api/sync/request-result") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/sync/preview") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }
      if (url.pathname === "/api/sync/push" || url.pathname === "/api/sync/demo-failure" || url.pathname === "/api/sync/confirmation-action") {
        response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "method-not-allowed" }));
        return;
      }

      const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = normalize(join(publicRoot, requestedPath));
      if (!filePath.startsWith(publicRoot)) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }

      const content = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": mimeByExt.get(extname(filePath)) ?? "application/octet-stream"
      });
      response.end(content);
    } catch (error) {
      if (error?.code === "ENOENT") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Desktop app shell error: ${error.message}`);
    }
  });
}

function setLocalCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 2_097_152) {
      throw new Error("Request body is too large");
    }
  }
  return body ? JSON.parse(body) : {};
}

function createStatusPayload() {
  return {
    product: "LoginTo desktop shell",
    stage: "M1 core usable, desktop UI shell preview",
    workspaceRoot,
    publicRoot,
    capabilities: [
      "local vault records",
      "local app-state API",
      "reminder notification UI",
      "desktop reminder notification bridge",
      "near-field discovery candidates",
      "encrypted attachment preview",
      "face-to-face sync preview",
      "local-only terminal workflow"
    ]
  };
}

function createRequestBaseUrl(request) {
  const host = request.headers.host;
  if (typeof host === "string" && host.trim()) {
    return `http://${host}`;
  }
  const address = request.socket.localAddress === "::1" ? "127.0.0.1" : request.socket.localAddress ?? "127.0.0.1";
  return `http://${address}:${request.socket.localPort}`;
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
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}
