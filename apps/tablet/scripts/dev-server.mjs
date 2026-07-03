import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import {
  actOnTabletShellSyncConfirmation,
  applyTabletShellReminderAction,
  applyTabletShellReviewAction,
  createTabletShellAppState,
  createTabletShellNearFieldDiscovery,
  createTabletShellRecord,
  createTabletShellSyncPreview,
  createTabletStatusPayload,
  deleteTabletShellRecord,
  exportTabletShellBackupPackage,
  getTabletShellSyncSummary,
  publicRoot,
  pushTabletShellSyncToDesktop,
  receiveTabletShellSyncPackage,
  receiveTabletShellSyncRequest,
  receiveTabletShellSyncRequestResult,
  removeTabletShellAttachment,
  resolveTabletShellDiscoveryCandidateAction,
  revokeTabletShellTrustedDevice,
  simulateTabletShellSyncFailure,
  trustTabletShellDesktop,
  updateTabletShellRecord,
  updateTabletShellReviewNotes,
  verifyTabletShellBackupPackage
} from "./app-state.mjs";

const shouldOpen = process.argv.includes("--open");
const requestedPort = Number(process.env.LOGINTO_TABLET_PORT ?? "0");

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
  const server = createTabletShellServer();
  server.listen(requestedPort, "127.0.0.1", () => {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}`;
    console.log(`LoginTo tablet shell running at ${url}`);
    console.log(`Status endpoint: ${url}/api/status`);
    if (shouldOpen) {
      openBrowser(url);
    }
  });
}

export function createTabletShellServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/api/status") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(createTabletStatusPayload(), null, 2));
        return;
      }
      if (url.pathname === "/api/app-state") {
        const appState = await createTabletShellAppState();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(appState, null, 2));
        return;
      }
      if (url.pathname === "/api/discovery/scan" && request.method === "POST") {
        const body = await readJsonBody(request);
        const discovery = await createTabletShellNearFieldDiscovery(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, discovery }, null, 2));
        return;
      }
      if (url.pathname === "/api/discovery/resolve" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await resolveTabletShellDiscoveryCandidateAction(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/review/confirm" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await applyTabletShellReviewAction(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/reminders/action" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await applyTabletShellReminderAction(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/pairing/trust" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await trustTabletShellDesktop(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/trusted-devices" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const result = await revokeTabletShellTrustedDevice(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/review/notes" && request.method === "PATCH") {
        const body = await readJsonBody(request);
        const result = await updateTabletShellReviewNotes(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await createTabletShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "PATCH") {
        const body = await readJsonBody(request);
        const result = await updateTabletShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/records" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const result = await deleteTabletShellRecord(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/attachments" && request.method === "DELETE") {
        const body = await readJsonBody(request);
        const result = await removeTabletShellAttachment(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/backup/export" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await exportTabletShellBackupPackage(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/backup/verify" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await verifyTabletShellBackupPackage(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/receive" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await receiveTabletShellSyncPackage(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/request" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await receiveTabletShellSyncRequest(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/request-result" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await receiveTabletShellSyncRequestResult(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/summary") {
        const result = await getTabletShellSyncSummary();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/preview" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await createTabletShellSyncPreview(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/push" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await pushTabletShellSyncToDesktop(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/demo-failure" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await simulateTabletShellSyncFailure(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (url.pathname === "/api/sync/confirmation-action" && request.method === "POST") {
        const body = await readJsonBody(request);
        const result = await actOnTabletShellSyncConfirmation(body);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result, null, 2));
        return;
      }
      if (["/api/review/confirm", "/api/reminders/action", "/api/pairing/trust", "/api/trusted-devices", "/api/review/notes", "/api/records", "/api/backup/export", "/api/backup/verify", "/api/sync/receive", "/api/sync/request", "/api/sync/request-result", "/api/sync/preview", "/api/sync/push", "/api/sync/demo-failure", "/api/sync/confirmation-action"].includes(url.pathname)) {
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
      response.end(`Tablet app shell error: ${error.message}`);
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
