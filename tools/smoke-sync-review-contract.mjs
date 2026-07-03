import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const terminalFiles = [
  "review-contract-desktop.vault-snapshot.json",
  "review-contract-mobile.vault-snapshot.json",
  "review-contract-tablet.vault-snapshot.json",
  "review-contract-desktop.runtime-state.json",
  "review-contract-mobile.runtime-state.json",
  "review-contract-tablet.runtime-state.json",
  "review-contract-desktop.device-identity.json",
  "review-contract-mobile.device-identity.json",
  "review-contract-tablet.device-identity.json",
  "review-contract-desktop.sync-confirmations.json",
  "review-contract-mobile.sync-confirmations.json",
  "review-contract-tablet.sync-confirmations.json",
  "review-contract-desktop.sync-receipts.json",
  "review-contract-mobile.sync-receipts.json",
  "review-contract-tablet.sync-receipts.json"
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

  const desktopSummary = await getJson(`${desktopBaseUrl}/api/sync/summary`);
  const mobileSummary = await getJson(`${mobileBaseUrl}/api/sync/summary`);
  const tabletSummary = await getJson(`${tabletBaseUrl}/api/sync/summary`);

  const desktopPairing = await postJson(`${desktopBaseUrl}/api/pairing/start`, {
    ttlSeconds: 31_536_000
  });
  await trustDesktopWithDevice(desktopBaseUrl, desktopPairing.pairingPayload, mobileSummary.device, "pairing_review_mobile");
  await trustDesktopWithDevice(desktopBaseUrl, desktopPairing.pairingPayload, tabletSummary.device, "pairing_review_tablet");
  await postJson(`${mobileBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });
  await postJson(`${tabletBaseUrl}/api/pairing/trust`, {
    payloadText: desktopPairing.qrPayloadText,
    confirmedCode: desktopPairing.sixDigitCode
  });

  await assertPublicPeerRejected(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: "https://example.com",
    targetDeviceId: mobileSummary.device.id,
    targetDeviceName: mobileSummary.device.name,
    targetPublicKeyBase64: mobileSummary.device.publicKeyBase64
  }, "desktop public sync target");
  await assertPublicPeerRejected(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: "http://127.evil.test:4177",
    targetDeviceId: mobileSummary.device.id,
    targetDeviceName: mobileSummary.device.name,
    targetPublicKeyBase64: mobileSummary.device.publicKeyBase64
  }, "desktop disguised public sync target");
  await assertPublicPeerRejected(`${mobileBaseUrl}/api/sync/preview`, {
    desktopBaseUrl: "https://example.com",
    desktopDeviceId: desktopSummary.device.id,
    desktopDeviceName: desktopSummary.device.name,
    desktopPublicKeyBase64: desktopSummary.device.publicKeyBase64
  }, "mobile public sync target");
  await assertPublicPeerRejected(`${mobileBaseUrl}/api/sync/preview`, {
    desktopBaseUrl: "http://10.evil.test:4173",
    desktopDeviceId: desktopSummary.device.id,
    desktopDeviceName: desktopSummary.device.name,
    desktopPublicKeyBase64: desktopSummary.device.publicKeyBase64
  }, "mobile disguised public sync target");
  await assertPublicPeerRejected(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl: "https://example.com",
    desktopDeviceId: desktopSummary.device.id,
    desktopDeviceName: desktopSummary.device.name,
    desktopPublicKeyBase64: desktopSummary.device.publicKeyBase64
  }, "tablet public sync target");
  await assertPublicPeerRejected(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl: "http://192.168.evil.test:4173",
    desktopDeviceId: desktopSummary.device.id,
    desktopDeviceName: desktopSummary.device.name,
    desktopPublicKeyBase64: desktopSummary.device.publicKeyBase64
  }, "tablet disguised public sync target");

  const unavailableBaseUrl = await createClosedLocalBaseUrl();
  assertUndeliveredRequestNotPending(await postJson(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: unavailableBaseUrl,
    targetDeviceId: mobileSummary.device.id,
    targetDeviceName: mobileSummary.device.name,
    targetPublicKeyBase64: mobileSummary.device.publicKeyBase64
  }), "desktop offline request");
  assertUndeliveredRequestNotPending(await postJson(`${mobileBaseUrl}/api/sync/preview`, {
    desktopBaseUrl: unavailableBaseUrl,
    desktopDeviceId: desktopSummary.device.id,
    desktopDeviceName: desktopSummary.device.name,
    desktopPublicKeyBase64: desktopSummary.device.publicKeyBase64
  }), "mobile offline request");
  assertUndeliveredRequestNotPending(await postJson(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl: unavailableBaseUrl,
    desktopDeviceId: desktopSummary.device.id,
    desktopDeviceName: desktopSummary.device.name,
    desktopPublicKeyBase64: desktopSummary.device.publicKeyBase64
  }), "tablet offline request");

  const desktopToMobile = await postJson(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "phone",
    targetBaseUrl: mobileBaseUrl,
    targetDeviceId: mobileSummary.device.id,
    targetDeviceName: mobileSummary.device.name,
    targetPublicKeyBase64: mobileSummary.device.publicKeyBase64,
    senderBaseUrl: desktopBaseUrl
  });
  assertReviewContract(desktopToMobile.confirmation, mobileSummary.device.name, "desktop-to-mobile");
  assertRequestDelivered(desktopToMobile, "desktop-to-mobile");
  assertIncomingRequest(
    await getJson(`${mobileBaseUrl}/api/app-state`),
    desktopToMobile.confirmation.id,
    desktopSummary.device.name,
    "mobile incoming desktop request"
  );
  const mobileConfirmsDesktop = await postJson(`${mobileBaseUrl}/api/sync/confirmation-action`, {
    confirmationId: `incoming_${desktopToMobile.confirmation.id}`,
    action: "confirm"
  });
  if (mobileConfirmsDesktop.resultDelivery?.ok !== true) {
    throw new Error("Expected mobile confirmation to call back desktop request result");
  }
  if (!mobileConfirmsDesktop.resultDelivery?.data?.autoSync?.sentChanges) {
    throw new Error("Expected mobile confirmation to trigger desktop auto sync");
  }
  assertNoPendingSourceConfirmation(
    await getJson(`${desktopBaseUrl}/api/app-state`),
    desktopToMobile.confirmation.id,
    "desktop original request after mobile confirm"
  );

  const desktopToTablet = await postJson(`${desktopBaseUrl}/api/sync/preview`, {
    targetKind: "tablet",
    targetBaseUrl: tabletBaseUrl,
    targetDeviceId: tabletSummary.device.id,
    targetDeviceName: tabletSummary.device.name,
    targetPublicKeyBase64: tabletSummary.device.publicKeyBase64,
    senderBaseUrl: desktopBaseUrl
  });
  assertReviewContract(desktopToTablet.confirmation, tabletSummary.device.name, "desktop-to-tablet");

  const mobileToDesktop = await postJson(`${mobileBaseUrl}/api/sync/preview`, {
    desktopBaseUrl,
    desktopDeviceId: desktopSummary.device.id,
    desktopDeviceName: desktopSummary.device.name,
    desktopPublicKeyBase64: desktopSummary.device.publicKeyBase64,
    senderBaseUrl: mobileBaseUrl
  });
  assertReviewContract(mobileToDesktop.confirmation, desktopSummary.device.name, "mobile-to-desktop");
  assertRequestDelivered(mobileToDesktop, "mobile-to-desktop");
  assertIncomingRequest(
    await getJson(`${desktopBaseUrl}/api/app-state`),
    mobileToDesktop.confirmation.id,
    mobileSummary.device.name,
    "desktop incoming mobile request"
  );
  const forgedDesktopResult = await postJsonAllowFailure(`${mobileBaseUrl}/api/sync/request-result`, {
    sourceConfirmationId: mobileToDesktop.confirmation.id,
    action: "confirm",
    senderDevice: {
      ...tabletSummary.device,
      id: "forged_tablet_sender"
    },
    actedAt: "2026-06-13T09:41:30.000Z"
  });
  if (forgedDesktopResult.ok || !forgedDesktopResult.text.includes("sender does not match")) {
    throw new Error("Expected forged sync request result sender to be rejected");
  }
  const desktopRejectsMobile = await postJson(`${desktopBaseUrl}/api/sync/confirmation-action`, {
    confirmationId: `incoming_${mobileToDesktop.confirmation.id}`,
    action: "reject"
  });
  if (desktopRejectsMobile.resultDelivery?.ok !== true) {
    throw new Error("Expected desktop rejection to call back mobile request result");
  }
  assertRejectedOrigin(
    await getJson(`${mobileBaseUrl}/api/app-state`),
    mobileToDesktop.confirmation.id,
    "mobile original request after desktop rejection"
  );

  const tabletToDesktop = await postJson(`${tabletBaseUrl}/api/sync/preview`, {
    desktopBaseUrl,
    desktopDeviceId: desktopSummary.device.id,
    desktopDeviceName: desktopSummary.device.name,
    desktopPublicKeyBase64: desktopSummary.device.publicKeyBase64,
    senderBaseUrl: tabletBaseUrl
  });
  assertReviewContract(tabletToDesktop.confirmation, desktopSummary.device.name, "tablet-to-desktop");

  const repairCandidate = await postJson(`${desktopBaseUrl}/api/discovery/resolve`, {
    candidate: {
      id: "candidate_desktop_review_contract_changed_key",
      device: {
        ...mobileSummary.device,
        publicKeyBase64: "changed-mobile-key"
      },
      transport: "local-network",
      endpoint: mobileBaseUrl,
      discoveredAt: "2026-06-30T10:00:00.000Z",
      trustStatus: "needs-repairing",
      requiresPairing: false,
      requiresRepairing: true,
      changeSummary: mobileSummary.summary
    }
  });

  if (repairCandidate.action !== "repair-pairing" || !repairCandidate.pairing?.sixDigitCode) {
    throw new Error("Expected changed trusted device key to create a re-pairing request");
  }

  console.log("Sync review contract smoke passed.");
  console.log(JSON.stringify({
    desktopToMobile: desktopToMobile.confirmation.review,
    desktopToTablet: desktopToTablet.confirmation.review,
    mobileToDesktop: mobileToDesktop.confirmation.review,
    tabletToDesktop: tabletToDesktop.confirmation.review,
    repairAction: repairCandidate.action
  }, null, 2));
} finally {
  await Promise.all([
    closeServer(desktopServer),
    closeServer(mobileServer),
    closeServer(tabletServer)
  ]);
}

function assertReviewContract(confirmation, expectedPeerName, label) {
  const review = confirmation.review;
  if (!review) {
    throw new Error(`Missing sync review contract for ${label}`);
  }
  if (review.peerDeviceName !== expectedPeerName) {
    throw new Error(`Review peer device mismatch for ${label}: ${review.peerDeviceName}`);
  }
  if (!Number.isFinite(Date.parse(review.requestedAt))) {
    throw new Error(`Review requestedAt must be an ISO date-time for ${label}`);
  }
  if (!Number.isFinite(Date.parse(review.expiresAt))) {
    throw new Error(`Review expiresAt must be an ISO date-time for ${label}`);
  }
  if (Date.parse(review.expiresAt) <= Date.parse(review.requestedAt)) {
    throw new Error(`Review expiresAt must be after requestedAt for ${label}`);
  }
  if (review.transport !== "local-network") {
    throw new Error(`Review transport must show the local connection mode for ${label}`);
  }
  if (!review.peerBaseUrl?.startsWith("http://127.0.0.1:")) {
    throw new Error(`Review peerBaseUrl must show the local peer address for ${label}: ${review.peerBaseUrl}`);
  }
  if (!/^[0-9a-f]{4}-[0-9a-f]{4}$/.test(review.peerKeyFingerprint ?? "")) {
    throw new Error(`Review peerKeyFingerprint must expose a stable device fingerprint for ${label}: ${review.peerKeyFingerprint}`);
  }
  if (review.publicNetworkLogin !== false) {
    throw new Error(`Review must explicitly reject public-network login for ${label}`);
  }
  if (review.requiresRepairing !== false || review.pairingAction !== "not-required") {
    throw new Error(`Trusted sync review must not require re-pairing for ${label}`);
  }
  if (!review.summaryText.includes("发送") || !review.summaryText.includes("接收") || !review.summaryText.includes("冲突")) {
    throw new Error(`Review summary must include send/receive/conflict counts for ${label}`);
  }
  if (!Number.isInteger(review.changeSummary?.sendChanges) || !Number.isInteger(review.changeSummary?.receiveChanges)) {
    throw new Error(`Review changeSummary must expose structured counts for ${label}`);
  }
  if (!Array.isArray(review.recordLines)) {
    throw new Error(`Review must expose record-level lines for ${label}`);
  }
}

function assertRequestDelivered(result, label) {
  if (result.requestDelivery?.ok !== true) {
    throw new Error(`Expected ${label} sync request to be delivered to peer`);
  }
}

function assertIncomingRequest(appState, sourceConfirmationId, expectedPeerName, label) {
  const panel = appState.syncPanel ?? appState.sync;
  const pending = panel?.pendingConfirmation;
  if (!pending) {
    throw new Error(`Expected ${label} to have a pending incoming sync request`);
  }
  if (pending.sourceConfirmationId !== sourceConfirmationId || pending.requestRole !== "receiver") {
    throw new Error(`Expected ${label} to reference delivered source confirmation`);
  }
  if (pending.peerDevice?.name !== expectedPeerName) {
    throw new Error(`Expected ${label} peer to be ${expectedPeerName}, got ${pending.peerDevice?.name}`);
  }
  const centerItem = panel?.syncCenter?.items?.find((item) => item.confirmationId === pending.id);
  if (!centerItem || centerItem.action !== "review-sync") {
    throw new Error(`Expected ${label} sync center to expose pending confirmation action`);
  }
}

function assertNoPendingSourceConfirmation(appState, sourceConfirmationId, label) {
  const panel = appState.syncPanel ?? appState.sync;
  const pending = panel?.pendingConfirmation;
  if (pending?.id === sourceConfirmationId) {
    throw new Error(`Expected ${label} to no longer expose pending source confirmation`);
  }
}

function assertRejectedOrigin(appState, sourceConfirmationId, label) {
  const panel = appState.syncPanel ?? appState.sync;
  if (panel?.pendingConfirmation?.id === sourceConfirmationId) {
    throw new Error(`Expected ${label} to leave pending state`);
  }
  if (panel?.connectionState?.stage !== "peer-rejected") {
    throw new Error(`Expected ${label} to show peer-rejected, got ${panel?.connectionState?.stage}`);
  }
  if (panel?.lastReceiptSummary?.failureReason !== "peer-rejected") {
    throw new Error(`Expected ${label} to record peer-rejected failure receipt`);
  }
}

async function assertPublicPeerRejected(url, body, label) {
  const result = await postJsonAllowFailure(url, body);
  if (result.ok || !result.text.includes("public network sync is not allowed")) {
    throw new Error(`Expected ${label} to reject public-network sync target: ${result.text}`);
  }
}

function assertUndeliveredRequestNotPending(result, label) {
  if (result.requestDelivery?.ok !== false) {
    throw new Error(`Expected ${label} request delivery to fail`);
  }
  const panel = result.appState.syncPanel ?? result.appState.sync;
  if (panel?.pendingConfirmation?.id === result.confirmation.id) {
    throw new Error(`Expected ${label} not to expose an undelivered request as pending`);
  }
  if (panel?.lastReceiptSummary?.status !== "failure" || panel?.syncCenter?.failureCount < 1) {
    throw new Error(`Expected ${label} to expose a failure receipt and recovery state`);
  }
}

async function createClosedLocalBaseUrl() {
  const server = createServer();
  await listen(server);
  const baseUrl = createBaseUrl(server);
  await closeServer(server);
  return baseUrl;
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

async function trustDesktopWithDevice(desktopBaseUrl, localPairingPayload, device, sessionId) {
  const remotePairingPayload = sync.createPairingPayload({
    device,
    sessionId,
    localEndpoint: `http://127.0.0.1:${device.kind === "tablet" ? 4178 : 4177}`,
    ttlSeconds: 31_536_000,
    now: () => "2026-12-20T09:00:00.000Z"
  });
  const verification = sync.createPairingVerification(localPairingPayload, remotePairingPayload);
  const trusted = await postJson(`${desktopBaseUrl}/api/pairing/confirm`, {
    localSessionId: localPairingPayload.sessionId,
    remotePairingPayload,
    confirmedCode: verification.sixDigitCode,
    ttlSeconds: 31_536_000
  });
  if (!trusted.ok) {
    throw new Error(`Expected desktop to trust ${device.id}`);
  }
}
