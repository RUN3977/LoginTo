import { createServer } from "node:http";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "failure-receipts-desktop.vault-snapshot.json",
  "failure-receipts-mobile.vault-snapshot.json",
  "failure-receipts-desktop.runtime-state.json",
  "failure-receipts-mobile.runtime-state.json",
  "failure-receipts-desktop.device-identity.json",
  "failure-receipts-mobile.device-identity.json",
  "failure-receipts-desktop.sync-confirmations.json",
  "failure-receipts-mobile.sync-confirmations.json",
  "failure-receipts-desktop.sync-receipts.json",
  "failure-receipts-mobile.sync-receipts.json",
  "failure-receipts-tablet.vault-snapshot.json",
  "failure-receipts-tablet.runtime-state.json",
  "failure-receipts-tablet.device-identity.json",
  "failure-receipts-tablet.sync-confirmations.json",
  "failure-receipts-tablet.sync-receipts.json"
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
process.env.LOGINTO_TABLET_SHELL_VAULT_PATH = terminalFiles[10];
process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH = terminalFiles[11];
process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH = terminalFiles[12];
process.env.LOGINTO_TABLET_SYNC_CONFIRMATIONS_PATH = terminalFiles[13];
process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH = terminalFiles[14];

const desktop = await import("../apps/desktop/scripts/dev-server.mjs");
const mobile = await import("../apps/mobile/scripts/dev-server.mjs");
const tablet = await import("../apps/tablet/scripts/dev-server.mjs");
const sync = await import("../packages/sync-core/src/index.ts");

const desktopServer = desktop.createDesktopShellServer();
const mobileServer = mobile.createMobileShellServer();
const tabletServer = tablet.createTabletShellServer();
const failedPhone = createFailingTerminalServer({
  kind: "phone",
  deviceId: "device_fake_phone_failure",
  name: "Failing Phone"
});
const failedDesktop = createFailingTerminalServer({
  kind: "desktop",
  deviceId: "device_fake_desktop_failure",
  name: "Failing Desktop"
});

try {
  await Promise.all([
    listen(desktopServer),
    listen(mobileServer),
    listen(tabletServer),
    listen(failedPhone),
    listen(failedDesktop)
  ]);

  const desktopBaseUrl = createBaseUrl(desktopServer);
  const mobileBaseUrl = createBaseUrl(mobileServer);
  const tabletBaseUrl = createBaseUrl(tabletServer);
  const failedPhoneBaseUrl = createBaseUrl(failedPhone);
  const failedDesktopBaseUrl = createBaseUrl(failedDesktop);
  await trustDesktopWithDevice(desktopBaseUrl, {
    id: "device_fake_phone_failure",
    name: "Failing Phone",
    kind: "phone",
    publicKeyBase64: "phone-failure-public-key"
  }, failedPhoneBaseUrl);
  await trustMobileWithDevice(mobileBaseUrl, {
    id: "device_fake_desktop_failure",
    name: "Failing Desktop",
    kind: "desktop",
    publicKeyBase64: "desktop-failure-public-key"
  }, failedDesktopBaseUrl);
  await trustTabletWithDevice(tabletBaseUrl, {
    id: "device_fake_desktop_failure",
    name: "Failing Desktop",
    kind: "desktop",
    publicKeyBase64: "desktop-failure-public-key"
  }, failedDesktopBaseUrl);

  const desktopPreview = await postJson(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: failedPhoneBaseUrl,
    targetDeviceId: "device_fake_phone_failure",
    targetDeviceName: "Failing Phone"
  });
  const desktopFailure = await postJsonAllowFailure(`${desktopBaseUrl}/api/sync/push`, {
    targetKind: "phone",
    targetBaseUrl: failedPhoneBaseUrl,
    targetDeviceId: "device_fake_phone_failure",
    targetDeviceName: "Failing Phone",
    confirmationId: desktopPreview.confirmation.id
  });
  if (desktopFailure.ok || !desktopFailure.text.includes("Target sync receive failed")) {
    throw new Error(`Expected desktop push to fail after target receive error: ${desktopFailure.text}`);
  }
  const desktopReplay = await postJsonAllowFailure(`${desktopBaseUrl}/api/sync/push`, {
    targetKind: "phone",
    targetBaseUrl: failedPhoneBaseUrl,
    targetDeviceId: "device_fake_phone_failure",
    targetDeviceName: "Failing Phone",
    confirmationId: desktopPreview.confirmation.id
  });
  assertConsumedConfirmationReplay(desktopReplay, "desktop failed confirmation replay");

  const mobilePreview = await postJson(`${mobileBaseUrl}/api/sync/preview`, {
    desktopBaseUrl: failedDesktopBaseUrl,
    desktopDeviceId: "device_fake_desktop_failure",
    desktopDeviceName: "Failing Desktop",
    desktopPublicKeyBase64: "desktop-failure-public-key"
  });
  const mobileFailure = await postJsonAllowFailure(`${mobileBaseUrl}/api/sync/push`, {
    desktopBaseUrl: failedDesktopBaseUrl,
    desktopDeviceId: "device_fake_desktop_failure",
    desktopDeviceName: "Failing Desktop",
    desktopPublicKeyBase64: "desktop-failure-public-key",
    confirmationId: mobilePreview.confirmation.id
  });
  if (mobileFailure.ok || !mobileFailure.text.includes("Desktop sync receive failed")) {
    throw new Error(`Expected mobile push to fail after desktop receive error: ${mobileFailure.text}`);
  }
  const mobileReplay = await postJsonAllowFailure(`${mobileBaseUrl}/api/sync/push`, {
    desktopBaseUrl: failedDesktopBaseUrl,
    desktopDeviceId: "device_fake_desktop_failure",
    desktopDeviceName: "Failing Desktop",
    desktopPublicKeyBase64: "desktop-failure-public-key",
    confirmationId: mobilePreview.confirmation.id
  });
  assertConsumedConfirmationReplay(mobileReplay, "mobile failed confirmation replay");

  const tabletPreview = await postJson(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl: failedDesktopBaseUrl,
    desktopDeviceId: "device_fake_desktop_failure",
    desktopDeviceName: "Failing Desktop",
    desktopPublicKeyBase64: "desktop-failure-public-key"
  });
  const tabletFailure = await postJsonAllowFailure(`${tabletBaseUrl}/api/sync/push`, {
    desktopBaseUrl: failedDesktopBaseUrl,
    desktopDeviceId: "device_fake_desktop_failure",
    desktopDeviceName: "Failing Desktop",
    desktopPublicKeyBase64: "desktop-failure-public-key",
    confirmationId: tabletPreview.confirmation.id
  });
  if (tabletFailure.ok || !tabletFailure.text.includes("Desktop sync receive failed")) {
    throw new Error(`Expected tablet push to fail after desktop receive error: ${tabletFailure.text}`);
  }
  const tabletReplay = await postJsonAllowFailure(`${tabletBaseUrl}/api/sync/push`, {
    desktopBaseUrl: failedDesktopBaseUrl,
    desktopDeviceId: "device_fake_desktop_failure",
    desktopDeviceName: "Failing Desktop",
    desktopPublicKeyBase64: "desktop-failure-public-key",
    confirmationId: tabletPreview.confirmation.id
  });
  assertConsumedConfirmationReplay(tabletReplay, "tablet failed confirmation replay");

  const desktopReceipts = await readReceipts(terminalFiles[8]);
  const mobileReceipts = await readReceipts(terminalFiles[9]);
  const tabletReceipts = await readReceipts(terminalFiles[14]);
  const desktopConfirmations = await readConfirmations(terminalFiles[6]);
  const mobileConfirmations = await readConfirmations(terminalFiles[7]);
  const tabletConfirmations = await readConfirmations(terminalFiles[13]);
  await assertNoTempFile(terminalFiles[6], "desktop sync confirmations");
  await assertNoTempFile(terminalFiles[7], "mobile sync confirmations");
  await assertNoTempFile(terminalFiles[8], "desktop sync receipts");
  await assertNoTempFile(terminalFiles[9], "mobile sync receipts");
  await assertNoTempFile(terminalFiles[13], "tablet sync confirmations");
  await assertNoTempFile(terminalFiles[14], "tablet sync receipts");
  const desktopReceipt = desktopReceipts.at(-1);
  const mobileReceipt = mobileReceipts.at(-1);
  const tabletReceipt = tabletReceipts.at(-1);
  assertFailedConfirmation(desktopConfirmations, desktopPreview.confirmation.id, "desktop failed sync confirmation");
  assertFailedConfirmation(mobileConfirmations, mobilePreview.confirmation.id, "mobile failed sync confirmation");
  assertFailedConfirmation(tabletConfirmations, tabletPreview.confirmation.id, "tablet failed sync confirmation");
  assertFailureReceipt(desktopReceipt, {
    label: "desktop outgoing failure",
    peerDeviceId: "device_fake_phone_failure",
    peerName: "Failing Phone"
  });
  assertFailureReceipt(mobileReceipt, {
    label: "mobile outgoing failure",
    peerDeviceId: "device_fake_desktop_failure",
    peerName: "Failing Desktop"
  });
  assertFailureReceipt(tabletReceipt, {
    label: "tablet outgoing failure",
    peerDeviceId: "device_fake_desktop_failure",
    peerName: "Failing Desktop"
  });
  const desktopState = await getJson(`${desktopBaseUrl}/api/app-state`);
  const mobileState = await getJson(`${mobileBaseUrl}/api/app-state`);
  const tabletState = await getJson(`${tabletBaseUrl}/api/app-state`);
  assertFailureState(desktopState.sync, "desktop failure state");
  assertFailureState(mobileState.syncPanel, "mobile failure state");
  assertFailureState(tabletState.syncPanel, "tablet failure state");

  console.log("Sync failure receipt smoke test passed.");
  console.log(JSON.stringify({
    desktopFailure: summarizeReceipt(desktopReceipt),
    mobileFailure: summarizeReceipt(mobileReceipt),
    tabletFailure: summarizeReceipt(tabletReceipt),
    consumedConfirmations: [
      desktopPreview.confirmation.id,
      mobilePreview.confirmation.id,
      tabletPreview.confirmation.id
    ]
  }, null, 2));
} finally {
  await Promise.all([
    closeServer(desktopServer),
    closeServer(mobileServer),
    closeServer(tabletServer),
    closeServer(failedPhone),
    closeServer(failedDesktop)
  ]);
}

function createFailingTerminalServer(input) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/api/app-state") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        runtime: {
          deviceId: input.deviceId
        },
        syncPanel: {
          localDevice: {
            id: input.deviceId,
            name: input.name,
            kind: input.kind,
            publicKeyBase64: `${input.kind}-failure-public-key`
          }
        }
      }));
      return;
    }
    if (url.pathname === "/api/sync/summary") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        ok: true,
        device: {
          id: input.deviceId,
          name: input.name,
          kind: input.kind,
          publicKeyBase64: `${input.kind}-failure-public-key`
        },
        summary: {
          deviceId: input.deviceId,
          totalChanges: 0,
          lastChangeAt: undefined,
          entities: {}
        },
        records: []
      }));
      return;
    }
    if (url.pathname === "/api/sync/request") {
      await readRequestBody(request);
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === "/api/sync/receive") {
      await readRequestBody(request);
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "forced-sync-receive-failure" }));
      return;
    }
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "not-found" }));
  });
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

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function postJsonAllowFailure(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text
  };
}

async function trustDesktopWithDevice(desktopBaseUrl, device, endpoint) {
  const localPairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  const remotePairingPayload = sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: device.id,
      name: device.name,
      kind: device.kind,
      publicKeyBase64: device.publicKeyBase64,
      now: () => "2026-12-20T09:00:00.000Z"
    }),
    sessionId: `failure_receipts_${device.id}`,
    localEndpoint: endpoint,
    ttlSeconds: 31_536_000,
    now: () => "2026-12-20T09:00:00.000Z"
  });
  const verification = sync.createPairingVerification(localPairing.pairingPayload, remotePairingPayload);
  const trusted = await postJson(`${desktopBaseUrl}/api/pairing/confirm`, {
    localSessionId: localPairing.pairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode
  });
  if (!trusted.ok) {
    throw new Error(`Expected desktop to trust ${device.id} before failure receipt sync`);
  }
}

async function trustMobileWithDevice(mobileBaseUrl, device, endpoint) {
  const pairingPayload = sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: device.id,
      name: device.name,
      kind: device.kind,
      publicKeyBase64: device.publicKeyBase64,
      now: () => "2026-06-13T09:41:00.000Z"
    }),
    localEndpoint: endpoint,
    ttlSeconds: 31_536_000,
    now: () => "2026-06-13T09:41:00.000Z"
  });
  const qr = sync.encodePairingPayloadQr(pairingPayload);
  const trusted = await postJson(`${mobileBaseUrl}/api/pairing/trust`, {
    payloadText: qr.payloadText,
    confirmedCode: createPreviewVerificationCode(qr.payloadText)
  });
  if (!trusted.ok) {
    throw new Error(`Expected mobile to trust ${device.id} before failure receipt sync`);
  }
}

async function trustTabletWithDevice(tabletBaseUrl, device, endpoint) {
  const pairingPayload = sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: device.id,
      name: device.name,
      kind: device.kind,
      publicKeyBase64: device.publicKeyBase64,
      now: () => "2026-06-25T09:00:00.000Z"
    }),
    localEndpoint: endpoint,
    ttlSeconds: 31_536_000,
    now: () => "2026-06-25T09:00:00.000Z"
  });
  const qr = sync.encodePairingPayloadQr(pairingPayload);
  const trusted = await postJson(`${tabletBaseUrl}/api/pairing/trust`, {
    payloadText: qr.payloadText,
    confirmedCode: createPreviewVerificationCode(qr.payloadText)
  });
  if (!trusted.ok) {
    throw new Error(`Expected tablet to trust ${device.id} before failure receipt sync`);
  }
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readReceipts(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  return parsed.receipts;
}

async function readConfirmations(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  return parsed.confirmations;
}

async function assertNoTempFile(path, label) {
  try {
    await readFile(`${path}.tmp`, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`Expected ${label} atomic write to remove temp file`);
}

function assertFailedConfirmation(confirmations, confirmationId, label) {
  const confirmation = confirmations.find((item) => item.id === confirmationId);
  if (!confirmation) {
    throw new Error(`Expected ${label} to be persisted`);
  }
  if (confirmation.status !== "failed" || !confirmation.failedAt) {
    throw new Error(`Expected ${label} to be consumed as failed`);
  }
}

function assertConsumedConfirmationReplay(result, label) {
  if (result.ok) {
    throw new Error(`Expected ${label} to reject reused sync confirmation`);
  }
  if (!result.text.includes("not pending: failed")) {
    throw new Error(`Expected ${label} to fail with consumed confirmation status: ${result.text}`);
  }
}

function assertFailureReceipt(receipt, input) {
  if (receipt?.status !== "failure") {
    throw new Error(`Expected ${input.label} to persist failure status`);
  }
  if (receipt.peerDeviceId !== input.peerDeviceId || receipt.peerName !== input.peerName) {
    throw new Error(`Expected ${input.label} to persist peer identity`);
  }
  for (const field of ["syncedAt", "direction", "packageId", "transport", "error", "errorDetail"]) {
    if (typeof receipt[field] !== "string" || !receipt[field]) {
      throw new Error(`Expected ${input.label} to include ${field}`);
    }
  }
  if (!receipt.errorDetail.includes("forced-sync-receive-failure")) {
    throw new Error(`Expected ${input.label} to persist remote error detail: ${JSON.stringify(receipt)}`);
  }
  for (const field of ["sentCount", "receivedCount", "conflictCount"]) {
    if (typeof receipt[field] !== "number") {
      throw new Error(`Expected ${input.label} to include numeric ${field}`);
    }
  }
}

function assertFailureState(syncPanel, label) {
  const latest = syncPanel.lastReceiptSummary;
  if (
    latest?.status !== "failure"
    || !latest.errorDetail?.includes("forced-sync-receive-failure")
    || !latest.recoveryDetail?.includes("forced-sync-receive-failure")
    || !latest.recoveryActions?.includes("retry-sync")
    || !latest.retryRequest
  ) {
    throw new Error(`Expected ${label} to expose failure details in receipt summary: ${JSON.stringify(latest)}`);
  }
  const failureItem = syncPanel.syncCenter?.items?.find((item) => item.kind === "failure");
  if (
    !failureItem?.detail?.includes("forced-sync-receive-failure")
    || failureItem.action !== "retry-sync"
    || !failureItem.retryRequest
  ) {
    throw new Error(`Expected ${label} to expose failure detail in sync center: ${JSON.stringify(syncPanel.syncCenter)}`);
  }
}

function summarizeReceipt(receipt) {
  return {
    status: receipt.status,
    peerDeviceId: receipt.peerDeviceId,
    peerName: receipt.peerName,
    sentCount: receipt.sentCount,
    receivedCount: receipt.receivedCount,
    conflictCount: receipt.conflictCount,
    error: receipt.error,
    errorDetail: receipt.errorDetail
  };
}

function createPreviewVerificationCode(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String(Math.abs(hash) % 1_000_000).padStart(6, "0");
}
