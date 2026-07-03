import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "trust-gate-desktop.vault-snapshot.json",
  "trust-gate-mobile.vault-snapshot.json",
  "trust-gate-tablet.vault-snapshot.json",
  "trust-gate-desktop.runtime-state.json",
  "trust-gate-mobile.runtime-state.json",
  "trust-gate-tablet.runtime-state.json",
  "trust-gate-desktop.device-identity.json",
  "trust-gate-mobile.device-identity.json",
  "trust-gate-tablet.device-identity.json",
  "trust-gate-desktop.sync-confirmations.json",
  "trust-gate-mobile.sync-confirmations.json",
  "trust-gate-tablet.sync-confirmations.json",
  "trust-gate-desktop.sync-receipts.json",
  "trust-gate-mobile.sync-receipts.json",
  "trust-gate-tablet.sync-receipts.json"
].map((name) => join(root, ".tmp", name));

for (const file of terminalFiles) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

delete process.env.LOGINTO_SHARED_TERMINAL_VAULT_PATH;
process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH = terminalFiles[0];
process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH = terminalFiles[1];
process.env.LOGINTO_TABLET_SHELL_VAULT_PATH = terminalFiles[2];
process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH = terminalFiles[3];
process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH = terminalFiles[4];
process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH = terminalFiles[5];
process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH = terminalFiles[6];
process.env.LOGINTO_MOBILE_DEVICE_IDENTITY_PATH = terminalFiles[7];
process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH = terminalFiles[8];
process.env.LOGINTO_DESKTOP_SYNC_CONFIRMATIONS_PATH = terminalFiles[9];
process.env.LOGINTO_MOBILE_SYNC_CONFIRMATIONS_PATH = terminalFiles[10];
process.env.LOGINTO_TABLET_SYNC_CONFIRMATIONS_PATH = terminalFiles[11];
process.env.LOGINTO_TERMINAL_SYNC_RECEIPTS_PATH = terminalFiles[12];
process.env.LOGINTO_MOBILE_SYNC_RECEIPTS_PATH = terminalFiles[13];
process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH = terminalFiles[14];

const desktop = await import("../apps/desktop/scripts/dev-server.mjs");
const mobile = await import("../apps/mobile/scripts/dev-server.mjs");
const tablet = await import("../apps/tablet/scripts/dev-server.mjs");
const sync = await import("../packages/sync-core/src/index.ts");

const desktopServer = desktop.createDesktopShellServer();
const mobileServer = mobile.createMobileShellServer();
const tabletServer = tablet.createTabletShellServer();

try {
  await Promise.all([
    listen(desktopServer),
    listen(mobileServer),
    listen(tabletServer)
  ]);

  const desktopBaseUrl = createBaseUrl(desktopServer);
  const mobileBaseUrl = createBaseUrl(mobileServer);
  const tabletBaseUrl = createBaseUrl(tabletServer);

  const mobileState = await getJson(`${mobileBaseUrl}/api/app-state`);
  const desktopState = await getJson(`${desktopBaseUrl}/api/app-state`);
  const desktopSummary = await getJson(`${desktopBaseUrl}/api/sync/summary`);
  const mobileSummary = await getJson(`${mobileBaseUrl}/api/sync/summary`);
  const tabletSummary = await getJson(`${tabletBaseUrl}/api/sync/summary`);

  const desktopPreview = await postJsonAllowFailure(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: mobileBaseUrl,
    targetDeviceId: mobileState.runtime.deviceId,
    targetDeviceName: "LoginTo Phone Shell"
  });
  assertNotTrustedFailure(desktopPreview, "desktop to mobile preview");

  const desktopTabletPreview = await postJsonAllowFailure(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "tablet",
    targetBaseUrl: tabletBaseUrl,
    targetDeviceId: tabletSummary.device.id,
    targetDeviceName: "LoginTo Tablet Shell"
  });
  assertNotTrustedFailure(desktopTabletPreview, "desktop to tablet preview");

  const mobilePreview = await postJsonAllowFailure(`${mobileBaseUrl}/api/sync/preview`, {
    desktopBaseUrl,
    desktopDeviceId: desktopState.vault.deviceId,
    desktopDeviceName: "LoginTo Desktop Shell"
  });
  assertNotTrustedFailure(mobilePreview, "mobile to desktop preview");

  const desktopReceive = await postJsonAllowFailure(`${desktopBaseUrl}/api/sync/receive`, {
    senderDevice: {
      id: mobileSummary.device.id,
      name: mobileSummary.device.name,
      kind: mobileSummary.device.kind,
      publicKeyBase64: mobileSummary.device.publicKeyBase64
    },
    encryptedPackage: createFakeEncryptedPackage({
      senderDeviceId: mobileState.runtime.deviceId,
      receiverDeviceId: desktopState.vault.deviceId
    })
  });
  assertNotTrustedFailure(desktopReceive, "desktop receive from untrusted mobile");

  const mobileReceive = await postJsonAllowFailure(`${mobileBaseUrl}/api/sync/receive`, {
    senderDevice: {
      id: desktopSummary.device.id,
      name: desktopSummary.device.name,
      kind: desktopSummary.device.kind,
      publicKeyBase64: desktopSummary.device.publicKeyBase64
    },
    encryptedPackage: createFakeEncryptedPackage({
      senderDeviceId: desktopState.vault.deviceId,
      receiverDeviceId: mobileState.runtime.deviceId
    })
  });
  assertNotTrustedFailure(mobileReceive, "mobile receive from untrusted desktop");

  const tabletReceive = await postJsonAllowFailure(`${tabletBaseUrl}/api/sync/receive`, {
    senderDevice: {
      id: desktopSummary.device.id,
      name: desktopSummary.device.name,
      kind: desktopSummary.device.kind,
      publicKeyBase64: desktopSummary.device.publicKeyBase64
    },
    encryptedPackage: createFakeEncryptedPackage({
      senderDeviceId: desktopState.vault.deviceId,
      receiverDeviceId: tabletSummary.device.id
    })
  });
  assertNotTrustedFailure(tabletReceive, "tablet receive from untrusted desktop");

  await trustDesktopWithDevice(desktopBaseUrl, mobileBaseUrl, mobileSummary.device);
  await trustDesktopWithDevice(desktopBaseUrl, tabletBaseUrl, tabletSummary.device);
  const desktopPairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  await postJson(`${mobileBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  await postJson(`${tabletBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  const plaintextDesktopReceive = await postJsonAllowFailure(`${desktopBaseUrl}/api/sync/receive`, {
    senderDevice: mobileSummary.device,
    exchangePackage: createFakePlaintextExchangePackage({
      senderDeviceId: mobileSummary.device.id,
      receiverDeviceId: desktopSummary.device.id
    })
  });
  assertEncryptedRequiredFailure(plaintextDesktopReceive, "desktop receive plaintext package");
  const plaintextMobileReceive = await postJsonAllowFailure(`${mobileBaseUrl}/api/sync/receive`, {
    senderDevice: desktopSummary.device,
    exchangePackage: createFakePlaintextExchangePackage({
      senderDeviceId: desktopSummary.device.id,
      receiverDeviceId: mobileSummary.device.id
    })
  });
  assertEncryptedRequiredFailure(plaintextMobileReceive, "mobile receive plaintext package");
  const plaintextTabletReceive = await postJsonAllowFailure(`${tabletBaseUrl}/api/sync/receive`, {
    senderDevice: desktopSummary.device,
    exchangePackage: createFakePlaintextExchangePackage({
      senderDeviceId: desktopSummary.device.id,
      receiverDeviceId: tabletSummary.device.id
    })
  });
  assertEncryptedRequiredFailure(plaintextTabletReceive, "tablet receive plaintext package");

  console.log("Sync trust gate smoke test passed.");
  console.log(JSON.stringify({
    desktopPreviewStatus: desktopPreview.status,
    desktopTabletPreviewStatus: desktopTabletPreview.status,
    mobilePreviewStatus: mobilePreview.status,
    desktopReceiveStatus: desktopReceive.status,
    mobileReceiveStatus: mobileReceive.status,
    tabletReceiveStatus: tabletReceive.status,
    plaintextDesktopReceiveStatus: plaintextDesktopReceive.status,
    plaintextMobileReceiveStatus: plaintextMobileReceive.status,
    plaintextTabletReceiveStatus: plaintextTabletReceive.status
  }, null, 2));
} finally {
  await Promise.all([
    closeServer(desktopServer),
    closeServer(mobileServer),
    closeServer(tabletServer)
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

function assertNotTrustedFailure(result, label) {
  if (result.ok) {
    throw new Error(`Expected ${label} to require face-to-face pairing first`);
  }
  if (!result.text.includes("not trusted")) {
    throw new Error(`Expected ${label} to fail with a trust error: ${result.text}`);
  }
}

function assertEncryptedRequiredFailure(result, label) {
  if (result.ok) {
    throw new Error(`Expected ${label} to reject plaintext sync exchange packages`);
  }
  if (!result.text.includes("Encrypted sync exchange package is required")) {
    throw new Error(`Expected ${label} to require encrypted sync packages: ${result.text}`);
  }
}

async function trustDesktopWithDevice(desktopBaseUrl, endpoint, device) {
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
    sessionId: `trust_gate_${device.id}`,
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
    throw new Error(`Expected desktop to trust ${device.id}`);
  }
}

function createFakePlaintextExchangePackage(input) {
  return {
    protocol: "loginto-sync-exchange-v1",
    packageId: `fake_plaintext_${input.senderDeviceId}`,
    senderDeviceId: input.senderDeviceId,
    receiverDeviceId: input.receiverDeviceId,
    sessionId: "fake-plaintext-session",
    confirmationId: "fake-plaintext-confirmation",
    createdAt: "2026-06-13T09:41:00.000Z",
    changes: [],
    contentDigest: "fake-plaintext-content-digest"
  };
}

function createFakeEncryptedPackage(input) {
  return {
    protocol: "loginto-encrypted-sync-exchange-v1",
    packageId: `fake_package_${input.senderDeviceId}`,
    senderDeviceId: input.senderDeviceId,
    receiverDeviceId: input.receiverDeviceId,
    sessionId: "fake-session",
    confirmationId: "fake-confirmation",
    createdAt: "2026-06-13T09:41:00.000Z",
    contentDigest: "fake-content-digest",
    cipher: {
      algorithm: "aes-256-gcm",
      ivBase64: Buffer.alloc(12).toString("base64"),
      ciphertextBase64: Buffer.from("not a real encrypted package").toString("base64"),
      authTagBase64: Buffer.alloc(16).toString("base64")
    }
  };
}
