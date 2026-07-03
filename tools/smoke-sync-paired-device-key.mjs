import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "paired-key-desktop.vault-snapshot.json",
  "paired-key-mobile.vault-snapshot.json",
  "paired-key-desktop.runtime-state.json",
  "paired-key-mobile.runtime-state.json",
  "paired-key-desktop.device-identity.json",
  "paired-key-mobile.device-identity.json",
  "paired-key-desktop.sync-confirmations.json",
  "paired-key-mobile.sync-confirmations.json",
  "paired-key-desktop.sync-receipts.json",
  "paired-key-mobile.sync-receipts.json"
].map((name) => join(root, ".tmp", name));

for (const file of terminalFiles) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

delete process.env.LOGINTO_SHARED_TERMINAL_VAULT_PATH;
process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH = terminalFiles[0];
process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH = terminalFiles[1];
process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH = terminalFiles[2];
process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH = terminalFiles[3];
process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH = terminalFiles[4];
process.env.LOGINTO_MOBILE_DEVICE_IDENTITY_PATH = terminalFiles[5];
process.env.LOGINTO_DESKTOP_SYNC_CONFIRMATIONS_PATH = terminalFiles[6];
process.env.LOGINTO_MOBILE_SYNC_CONFIRMATIONS_PATH = terminalFiles[7];
process.env.LOGINTO_TERMINAL_SYNC_RECEIPTS_PATH = terminalFiles[8];
process.env.LOGINTO_MOBILE_SYNC_RECEIPTS_PATH = terminalFiles[9];

const desktop = await import("../apps/desktop/scripts/dev-server.mjs");
const mobile = await import("../apps/mobile/scripts/dev-server.mjs");
const sync = await import("../packages/sync-core/src/index.ts");

const desktopServer = desktop.createDesktopShellServer();
const mobileServer = mobile.createMobileShellServer();
let capturedReceiveBody;
let advertisedMobileSummary;
const captureServer = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/api/app-state") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      runtime: {
        deviceId: advertisedMobileSummary.device.id
      },
      syncPanel: {
        localDevice: advertisedMobileSummary.device
      }
    }));
    return;
  }
  if (url.pathname === "/api/sync/summary") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(advertisedMobileSummary));
    return;
  }
  if (url.pathname === "/api/sync/request") {
    await readRequestBody(request);
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === "/api/sync/receive") {
    capturedReceiveBody = JSON.parse(await readRequestBody(request));
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      ok: true,
      receipt: {
        sentCount: 0,
        conflictCount: 0,
        conflicts: 0,
        appliedChanges: 0,
        resolvedConflicts: 0,
        transport: "local-network"
      }
    }));
    return;
  }
  response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "not-found" }));
});

try {
  await Promise.all([
    listen(desktopServer),
    listen(mobileServer)
  ]);
  const desktopBaseUrl = createBaseUrl(desktopServer);
  const mobileBaseUrl = createBaseUrl(mobileServer);
  advertisedMobileSummary = await fetchJson(`${mobileBaseUrl}/api/sync/summary`);
  const desktopSummary = await fetchJson(`${desktopBaseUrl}/api/sync/summary`);
  await trustDesktopAndPhone(desktopBaseUrl, mobileBaseUrl, advertisedMobileSummary.device.id);
  await listen(captureServer);
  const captureBaseUrl = createBaseUrl(captureServer);

  const preview = await postJson(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: captureBaseUrl,
    targetDeviceId: advertisedMobileSummary.device.id
  });
  await postJson(`${desktopBaseUrl}/api/sync/push`, {
    targetKind: "phone",
    targetBaseUrl: captureBaseUrl,
    targetDeviceId: advertisedMobileSummary.device.id,
    confirmationId: preview.confirmation.id
  });
  if (!capturedReceiveBody?.encryptedPackage) {
    throw new Error("Expected capture server to receive an encrypted sync package");
  }

  const tamperedSender = {
    ...desktopSummary.device,
    publicKeyBase64: "tampered-desktop-public-key"
  };
  const tamperedResult = await postJsonAllowFailure(`${mobileBaseUrl}/api/sync/receive`, {
    senderDevice: tamperedSender,
    encryptedPackage: capturedReceiveBody.encryptedPackage,
    transport: "local-network",
    receivedAt: "2026-12-20T09:05:00.000Z"
  });
  if (tamperedResult.ok) {
    throw new Error("Expected mobile receive to reject a package when sender public key material is tampered");
  }

  const acceptedResult = await postJson(`${mobileBaseUrl}/api/sync/receive`, {
    senderDevice: desktopSummary.device,
    encryptedPackage: capturedReceiveBody.encryptedPackage,
    transport: "local-network",
    receivedAt: "2026-12-20T09:06:00.000Z"
  });
  if (!acceptedResult.ok || acceptedResult.receipt.receivedCount < 1) {
    throw new Error("Expected mobile receive to accept the package with the correct paired sender identity");
  }

  console.log("Paired-device sync key smoke test passed.");
  console.log(JSON.stringify({
    encrypted: capturedReceiveBody.encryptedPackage.protocol,
    senderDeviceId: desktopSummary.device.id,
    receiverDeviceId: advertisedMobileSummary.device.id,
    tamperedStatus: tamperedResult.status,
    receivedCount: acceptedResult.receipt.receivedCount
  }, null, 2));
} finally {
  await Promise.all([
    closeServer(desktopServer),
    closeServer(mobileServer),
    closeServer(captureServer)
  ]);
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function createBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function postJsonAllowFailure(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text()
  };
}

async function trustDesktopAndPhone(desktopBaseUrl, mobileBaseUrl, mobileDeviceId) {
  const desktopPairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  const mobileSummary = await fetchJson(`${mobileBaseUrl}/api/sync/summary`);
  const remotePairingPayload = createRemotePairingPayload(mobileSummary.device, mobileBaseUrl, "paired_key_phone");
  const verification = sync.createPairingVerification(desktopPairing.pairingPayload, remotePairingPayload);
  const desktopTrust = await postJson(`${desktopBaseUrl}/api/pairing/confirm`, {
    localSessionId: desktopPairing.pairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode
  });
  if (!desktopTrust.ok) {
    throw new Error("Expected desktop to trust phone before paired-device key sync");
  }
  const phoneTrust = await postJson(`${mobileBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  if (!phoneTrust.ok) {
    throw new Error("Expected phone to trust desktop before paired-device key sync");
  }
}

function createRemotePairingPayload(device, endpoint, sessionId) {
  return sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: device.id,
      name: device.name,
      kind: device.kind,
      publicKeyBase64: device.publicKeyBase64,
      now: () => "2026-12-20T09:00:00.000Z"
    }),
    sessionId,
    localEndpoint: endpoint,
    ttlSeconds: 31_536_000,
    now: () => "2026-12-20T09:00:00.000Z"
  });
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
