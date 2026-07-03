import { createServer } from "node:http";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const desktopShell = await import("../apps/desktop/scripts/app-state.mjs");
const sync = await import("../packages/sync-core/src/index.ts");

const root = process.cwd();
const vaultPath = join(root, ".tmp", "desktop-sqlite-sync-state.vault-snapshot.json");
const sqliteVaultPath = join(root, ".tmp", "desktop-sqlite-sync-state.sqlite");
const runtimeStatePath = join(root, ".tmp", "desktop-sqlite-sync-state.runtime-state.json");
const deviceIdentityPath = join(root, ".tmp", "desktop-sqlite-sync-state.device-identity.json");
const syncReceiptPath = join(root, ".tmp", "desktop-sqlite-sync-state.sync-receipts.json");
const syncConfirmationPath = join(root, ".tmp", "desktop-sqlite-sync-state.sync-confirmations.json");
const syncDeletionPath = join(root, ".tmp", "desktop-sqlite-sync-state.sync-deletions.json");

for (const file of [
  vaultPath,
  sqliteVaultPath,
  runtimeStatePath,
  deviceIdentityPath,
  syncReceiptPath,
  syncConfirmationPath,
  syncDeletionPath
]) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

const shellInput = {
  vaultPath,
  sqliteVaultPath,
  runtimeStatePath,
  deviceIdentityPath,
  syncReceiptPath,
  syncConfirmationPath,
  syncDeletionPath,
  storageKind: "sqlite"
};

const failedPhone = createServer(async (request, response) => {
  if (request.url === "/api/sync/summary" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      ok: true,
      device: {
        id: "device_sqlite_failing_phone",
        name: "SQLite Failing Phone",
        kind: "phone",
        publicKeyBase64: "sqlite-failing-phone-public-key"
      },
      summary: {
        deviceId: "device_sqlite_failing_phone",
        totalChanges: 0,
        entities: {}
      },
      records: []
    }));
    return;
  }
  if (request.url === "/api/sync/request" && request.method === "POST") {
    await readRequestBody(request);
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.url === "/api/sync/receive" && request.method === "POST") {
    await readRequestBody(request);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("forced-sqlite-sync-receive-failure");
    return;
  }
  response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "not-found" }));
});

await listen(failedPhone);
const failedPhoneBaseUrl = createBaseUrl(failedPhone);

try {
  const pairingPreview = await desktopShell.confirmDesktopShellPairing(shellInput);
  const remotePairingPayload = sync.createPairingPayload({
    device: sync.createDeviceIdentity({
      id: "device_sqlite_failing_phone",
      name: "SQLite Failing Phone",
      kind: "phone",
      publicKeyBase64: "sqlite-failing-phone-public-key",
      now: () => "2026-12-20T09:00:00.000Z"
    }),
    sessionId: "sqlite_failing_phone_pairing",
    localEndpoint: failedPhoneBaseUrl,
    ttlSeconds: 31_536_000,
    now: () => "2026-12-20T09:00:00.000Z"
  });
  const verification = sync.createPairingVerification(pairingPreview.localPairingPayload, remotePairingPayload);
  const trusted = await desktopShell.confirmDesktopShellPairing({
    ...shellInput,
    localSessionId: pairingPreview.localPairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode
  });
  if (!trusted.ok || trusted.trustedDevices !== 1) {
    throw new Error("Expected desktop SQLite shell to trust the failing phone before sync");
  }

  const preview = await desktopShell.createDesktopShellSyncPreview({
    ...shellInput,
    targetKind: "phone",
    targetBaseUrl: failedPhoneBaseUrl,
    targetDeviceId: "device_sqlite_failing_phone",
    targetDeviceName: "SQLite Failing Phone",
    targetPublicKeyBase64: "sqlite-failing-phone-public-key"
  });
  if (!preview.confirmation?.id || preview.confirmation.status !== "pending") {
    throw new Error("Expected desktop SQLite shell to persist a pending sync confirmation");
  }

  let failed = false;
  try {
    await desktopShell.pushDesktopShellSyncToTerminal({
      ...shellInput,
      targetKind: "phone",
      targetBaseUrl: failedPhoneBaseUrl,
      targetDeviceId: "device_sqlite_failing_phone",
      targetDeviceName: "SQLite Failing Phone",
      targetPublicKeyBase64: "sqlite-failing-phone-public-key",
      confirmationId: preview.confirmation.id
    });
  } catch (error) {
    failed = String(error?.message ?? error).includes("Target sync receive failed");
  }
  if (!failed) {
    throw new Error("Expected desktop SQLite shell sync push to persist a failed receipt");
  }

  const confirmations = JSON.parse(await readFile(syncConfirmationPath, "utf8")).confirmations;
  const confirmation = confirmations.find((item) => item.id === preview.confirmation.id);
  if (confirmation?.status !== "failed" || !confirmation.failedAt) {
    throw new Error(`Expected failed SQLite sync confirmation: ${JSON.stringify(confirmation)}`);
  }

  const receipts = JSON.parse(await readFile(syncReceiptPath, "utf8")).receipts;
  const receipt = receipts.at(-1);
  if (
    receipt?.status !== "failure"
    || receipt.peerDeviceId !== "device_sqlite_failing_phone"
    || !receipt.errorDetail?.includes("forced-sqlite-sync-receive-failure")
  ) {
    throw new Error(`Expected failed SQLite sync receipt with remote detail: ${JSON.stringify(receipt)}`);
  }

  await assertNoTempFile(syncConfirmationPath, "sqlite sync confirmations");
  await assertNoTempFile(syncReceiptPath, "sqlite sync receipts");

  const appState = await desktopShell.createDesktopShellAppState(shellInput);
  const latest = appState.sync.lastReceiptSummary;
  if (
    latest?.status !== "failure"
    || !latest.retryRequest
    || !appState.sync.syncCenter?.items?.some((item) => item.kind === "failure" && item.action === "retry-sync")
  ) {
    throw new Error(`Expected desktop SQLite app-state to expose failure recovery: ${JSON.stringify(latest)}`);
  }

  const db = new DatabaseSync(sqliteVaultPath);
  const counts = {
    records: db.prepare("SELECT COUNT(*) AS count FROM records").get().count,
    fields: db.prepare("SELECT COUNT(*) AS count FROM record_fields").get().count,
    reminders: db.prepare("SELECT COUNT(*) AS count FROM reminders").get().count,
    snapshotRows: db.prepare("SELECT COUNT(*) AS count FROM vault_metadata WHERE key = 'snapshot_json'").get().count
  };
  db.close();

  if (counts.records < 4 || counts.snapshotRows !== 1) {
    throw new Error(`Expected desktop SQLite sync state smoke to keep normalized vault rows: ${JSON.stringify(counts)}`);
  }

  console.log("Desktop SQLite sync state smoke test passed.");
  console.log(JSON.stringify({
    storageKind: appState.vault.storageKind,
    confirmationStatus: confirmation.status,
    receiptStatus: receipt.status,
    retryAction: latest.retryRequest.targetDeviceName,
    normalizedRows: counts
  }, null, 2));
} finally {
  await closeServer(failedPhone);
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
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

async function assertNoTempFile(path, label) {
  try {
    await stat(`${path}.tmp`);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`Expected ${label} atomic temp file to be removed`);
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
