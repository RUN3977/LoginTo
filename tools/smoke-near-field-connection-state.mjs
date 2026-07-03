const sync = await import("../packages/sync-core/src/index.ts");

const now = "2026-07-02T09:00:00.000Z";
const desktop = {
  id: "device_desktop_connection",
  name: "LoginTo Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-key"
};
const phone = {
  id: "device_phone_connection",
  name: "LoginTo Phone",
  kind: "phone",
  publicKeyBase64: "phone-key"
};

const idle = sync.createNearFieldConnectionState({ now });
assert(idle.stage === "idle", "idle state should wait for a local scan");
assert(idle.publicNetworkLogin === false, "idle state should never require public-network login");

const offline = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [],
    probes: [
      {
        endpoint: "http://127.0.0.1:49999",
        transport: "local-network",
        reachable: false,
        error: "ECONNREFUSED"
      }
    ],
    transportPlan: sync.createNearFieldTransportPlan()
  }
});
assert(offline.stage === "offline", "offline state should be explicit when probes cannot reach peers");
assert(offline.nextAction === "scan", "offline state should guide users to rescan");
assert(offline.steps.some((step) => step.id === "discover" && step.status === "failed"), "offline state should mark discovery failed");

const untrustedCandidate = sync.createNearFieldDiscoveryCandidate({
  device: phone,
  transport: "local-network",
  endpoint: "http://127.0.0.1:4177",
  discoveredAt: now,
  trustedDevices: [],
  changeSummary: {
    deviceId: phone.id,
    lastLamport: 2,
    changeCount: 2,
    attachmentCount: 1
  }
});
const pairing = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [untrustedCandidate],
    probes: [],
    transportPlan: sync.createNearFieldTransportPlan()
  }
});
assert(pairing.stage === "pairing-required", "untrusted candidate should require face-to-face pairing");
assert(pairing.nextAction === "pair", "pairing state should guide users to pair");
assert(pairing.requiresFaceToFaceTrust === true, "pairing state must require face-to-face trust");

const changedKeyCandidate = sync.createNearFieldDiscoveryCandidate({
  device: { ...phone, publicKeyBase64: "changed-phone-key" },
  transport: "local-network",
  endpoint: "http://127.0.0.1:4177",
  discoveredAt: now,
  trustedDevices: [phone]
});
const repairing = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [changedKeyCandidate],
    probes: [],
    transportPlan: sync.createNearFieldTransportPlan()
  }
});
assert(repairing.stage === "repairing-required", "changed trusted key should require re-pairing");
assert(repairing.nextAction === "repair-pairing", "repairing state should guide users to re-pair");

const trustedCandidate = sync.createNearFieldDiscoveryCandidate({
  device: phone,
  transport: "local-network",
  endpoint: "http://127.0.0.1:4177",
  discoveredAt: now,
  trustedDevices: [phone]
});

const connecting = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [trustedCandidate],
    probes: [],
    transportPlan: sync.createNearFieldTransportPlan()
  },
  activeConnection: {
    stage: "connecting",
    peerDevice: phone,
    peerEndpoint: "http://127.0.0.1:4177",
    transport: "local-network",
    updatedAt: now
  }
});
assert(connecting.stage === "connecting", "active connection should show connecting state");
assert(connecting.nextAction === "wait", "connecting state should wait for the local channel");

const waitingPeer = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [trustedCandidate],
    probes: [],
    transportPlan: sync.createNearFieldTransportPlan()
  },
  activeConnection: {
    stage: "waiting-peer",
    peerDevice: phone,
    peerEndpoint: "http://127.0.0.1:4177",
    transport: "local-network",
    updatedAt: now
  }
});
assert(waitingPeer.stage === "waiting-peer", "active connection should show waiting-peer state");

const exchanging = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [trustedCandidate],
    probes: [],
    transportPlan: sync.createNearFieldTransportPlan()
  },
  activeConnection: {
    stage: "exchanging",
    peerDevice: phone,
    peerEndpoint: "http://127.0.0.1:4177",
    transport: "local-network",
    updatedAt: now
  }
});
assert(exchanging.stage === "exchanging", "active connection should show encrypted package exchange");

const waiting = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [trustedCandidate],
    probes: [],
    transportPlan: sync.createNearFieldTransportPlan()
  },
  pendingConfirmations: [
    {
      id: "sync_confirmation_connection",
      status: "pending",
      peerDevice: phone,
      peerBaseUrl: "http://127.0.0.1:4177",
      transport: "local-network",
      requestedAt: now,
      preview: {
        sendChanges: 4,
        receiveChanges: 3,
        conflicts: 1
      }
    }
  ]
});
assert(waiting.stage === "waiting-confirmation", "pending confirmation should be visible as a connection stage");
assert(waiting.requiresLocalConfirmation === true, "waiting state should require local confirmation");
assert(waiting.summary.includes("发送 4") && waiting.summary.includes("接收 3") && waiting.summary.includes("冲突 1"), "waiting summary should show change counts");

const complete = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [trustedCandidate],
    probes: [],
    transportPlan: sync.createNearFieldTransportPlan()
  },
  recentReceipts: [
    {
      status: "success",
      peerDeviceId: phone.id,
      peerName: phone.name,
      transport: "local-network",
      syncedAt: now
    }
  ]
});
assert(complete.stage === "complete", "successful receipt should produce a completed connection state");
assert(complete.nextAction === "done", "completed state should not ask for another immediate action");
assert(complete.steps.at(-1).status === "done", "completed state should mark all steps done");

const failed = sync.createNearFieldConnectionState({
  now,
  recentReceipts: [
    {
      status: "failure",
      peerDeviceId: phone.id,
      peerName: phone.name,
      transport: "local-network",
      targetBaseUrl: "http://127.0.0.1:4177",
      failureReason: "target-offline",
      recoveryTitle: "目标设备离线",
      errorDetail: "fetch failed"
    }
  ]
});
assert(failed.stage === "offline", "offline failure receipt should produce offline state");
assert(failed.peerEndpoint === "http://127.0.0.1:4177", "offline failure should retain retry endpoint");

const timedOut = sync.createNearFieldConnectionState({
  now,
  recentReceipts: [
    {
      status: "failure",
      peerDeviceId: phone.id,
      peerName: phone.name,
      transport: "local-network",
      targetBaseUrl: "http://127.0.0.1:4177",
      failureReason: "timeout",
      recoveryTitle: "连接超时",
      errorDetail: "AbortError: signal timed out"
    }
  ]
});
assert(timedOut.stage === "timed-out", "timeout failure should produce timed-out state");
assert(timedOut.nextAction === "retry-sync", "timeout should allow retrying sync");

const rejected = sync.createNearFieldConnectionState({
  now,
  recentReceipts: [
    {
      status: "failure",
      peerDeviceId: phone.id,
      peerName: phone.name,
      transport: "local-network",
      targetBaseUrl: "http://127.0.0.1:4177",
      failureReason: "peer-rejected",
      recoveryTitle: "对方拒绝同步",
      errorDetail: "rejected by peer"
    }
  ]
});
assert(rejected.stage === "peer-rejected", "peer rejection should produce peer-rejected state");

const recovered = sync.createNearFieldConnectionState({
  now,
  discovery: {
    localDeviceId: desktop.id,
    scannedAt: now,
    candidates: [trustedCandidate],
    probes: [],
    transportPlan: sync.createNearFieldTransportPlan()
  },
  recentReceipts: [
    {
      status: "success",
      peerDeviceId: phone.id,
      peerName: phone.name,
      transport: "local-network",
      syncedAt: now
    },
    {
      status: "failure",
      peerDeviceId: phone.id,
      peerName: phone.name,
      transport: "local-network",
      targetBaseUrl: "http://127.0.0.1:4177",
      failureReason: "target-offline",
      recoveryTitle: "目标设备离线",
      errorDetail: "fetch failed"
    }
  ]
});
assert(recovered.stage === "recovered", "success after failure should show recovered state");

console.log("Near-field connection state smoke passed.");
console.log(JSON.stringify({
  idle: idle.stage,
  offline: offline.stage,
  pairing: pairing.stage,
  repairing: repairing.stage,
  connecting: connecting.stage,
  waitingPeer: waitingPeer.stage,
  exchanging: exchanging.stage,
  waiting: waiting.stage,
  complete: complete.stage,
  failed: failed.stage,
  timedOut: timedOut.stage,
  rejected: rejected.stage,
  recovered: recovered.stage
}, null, 2));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
