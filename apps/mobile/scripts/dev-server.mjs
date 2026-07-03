import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import {
  actOnMobileShellSyncConfirmation,
  applyMobileShellReminderAction,
  commitMobileShellOcrDraft,
  createMobileShellAppState,
  createMobileShellNearFieldDiscovery,
  createMobileShellRecord,
  createMobileShellSyncPreview,
  createMobileStatusPayload,
  deleteMobileShellRecord,
  getMobileShellSyncSummary,
  publicRoot,
  pushMobileShellSyncToDesktop,
  receiveMobileShellSyncPackage,
  receiveMobileShellSyncRequest,
  receiveMobileShellSyncRequestResult,
  removeMobileShellAttachment,
  resolveMobileShellDiscoveryCandidateAction,
  revokeMobileShellTrustedDevice,
  scanMobileShellPairingPreview,
  simulateMobileShellSyncFailure,
  startMobileShellCameraCapture,
  trustMobileShellPairingPreview,
  updateMobileShellRecord
} from "./app-state.mjs";

const shouldOpen = process.argv.includes("--open");
const requestedPort = Number(process.env.LOGINTO_MOBILE_PORT ?? "0");

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
  const server = createMobileShellServer();
  server.listen(requestedPort, "127.0.0.1", () => {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}`;
    console.log(`LoginTo mobile shell running at ${url}`);
    console.log(`Status endpoint: ${url}/api/status`);
    if (shouldOpen) {
      openBrowser(url);
    }
  });
}

export function createMobileShellServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/api/status") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(createMobileStatusPayload(), null, 2));
        return;
      }
      if (url.pathname === "/api/app-state") {
        const appState = await createMobileShellAppState();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(appState, null, 2));
        return;
      }
      if (url.pathname === "/api/discovery/scan" && request.method === "POST") {
        const body = await readJsonBody(request);
        const discovery = await createMobileShellNearFieldDiscovery(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, discovery }, null, 2));
        return;
      }
      if (url.pathname === "/api/discovery/resolve" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await resolveMobileShellDiscoveryCandidateAction(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/reminders/action" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await applyMobileShellReminderAction(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/ocr/commit" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await commitMobileShellOcrDraft(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/capture/start" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await startMobileShellCameraCapture(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await createMobileShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "PATCH") {
        const body = await readJsonBody(request);
        const result = await updateMobileShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const result = await deleteMobileShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/attachments" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const result = await removeMobileShellAttachment(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/pairing/scan" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = scanMobileShellPairingPreview(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/pairing/trust" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await trustMobileShellPairingPreview(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/trusted-devices" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const result = await revokeMobileShellTrustedDevice(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/push" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await pushMobileShellSyncToDesktop(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/demo-failure" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await simulateMobileShellSyncFailure(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/confirmation-action" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await actOnMobileShellSyncConfirmation(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/summary") {
        const result = await getMobileShellSyncSummary();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/preview" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await createMobileShellSyncPreview(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/receive" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await receiveMobileShellSyncPackage(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/request" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await receiveMobileShellSyncRequest(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/request-result" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await receiveMobileShellSyncRequestResult(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (["/api/reminders/action", "/api/ocr/commit", "/api/capture/start", "/api/discovery/scan", "/api/records", "/api/pairing/scan", "/api/pairing/trust", "/api/trusted-devices", "/api/sync/push", "/api/sync/demo-failure", "/api/sync/confirmation-action", "/api/sync/preview", "/api/sync/receive", "/api/sync/request", "/api/sync/request-result"].includes(url.pathname)) {
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
      response.end(`Mobile app shell error: ${error.message}`);
    }
  });
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 131_072) {
      throw new Error("Request body is too large");
    }
  }
  return body ? JSON.parse(body) : {};
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
