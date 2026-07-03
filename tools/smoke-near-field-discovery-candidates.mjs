const sync = await import("../packages/sync-core/src/index.ts");

const trustedPhone = {
  id: "device_phone",
  name: "Zhang Phone",
  kind: "phone",
  publicKeyBase64: "phone-key",
  trustedAt: "2026-06-06T09:00:00.000Z"
};

const trusted = sync.createNearFieldDiscoveryCandidate({
  device: trustedPhone,
  trustedDevices: [trustedPhone],
  transport: "local-network",
  endpoint: "http://192.168.1.20:4177",
  discoveredAt: "2026-06-06T10:00:00.000Z",
  changeSummary: {
    deviceId: trustedPhone.id,
    lastLamport: 3,
    changeCount: 2,
    attachmentCount: 1
  }
});

if (trusted.trustStatus !== "trusted" || trusted.requiresPairing || trusted.requiresRepairing) {
  throw new Error("Expected matching trusted device to be ready for sync");
}

const unknownTablet = sync.createNearFieldDiscoveryCandidate({
  device: {
    id: "device_tablet",
    name: "Organizer Tablet",
    kind: "tablet",
    publicKeyBase64: "tablet-key"
  },
  trustedDevices: [trustedPhone],
  transport: "hotspot",
  endpoint: "http://172.20.10.2:4178",
  discoveredAt: "2026-06-06T10:00:00.000Z"
});

if (unknownTablet.trustStatus !== "needs-pairing" || !unknownTablet.requiresPairing) {
  throw new Error("Expected unknown tablet to require face-to-face pairing");
}

const changedPhone = sync.createNearFieldDiscoveryCandidate({
  device: {
    ...trustedPhone,
    publicKeyBase64: "changed-phone-key"
  },
  trustedDevices: [trustedPhone],
  transport: "local-network",
  endpoint: "http://192.168.1.22:4177",
  discoveredAt: "2026-06-06T10:00:00.000Z"
});

if (changedPhone.trustStatus !== "needs-repairing" || !changedPhone.requiresRepairing) {
  throw new Error("Expected changed public key to require re-pairing");
}

const snapshot = sync.createNearFieldDiscoverySnapshot({
  localDeviceId: "device_desktop",
  scannedAt: "2026-06-06T10:00:01.000Z",
  candidates: [unknownTablet, changedPhone, trusted]
});

if (snapshot.candidates[0].trustStatus !== "trusted" || snapshot.candidates[1].trustStatus !== "needs-repairing") {
  throw new Error("Expected discovery snapshot to sort trusted and re-pairing candidates first");
}

console.log("Near-field discovery candidate smoke test passed.");
console.log(
  JSON.stringify(
    {
      statuses: snapshot.candidates.map((candidate) => candidate.trustStatus),
      endpoints: snapshot.candidates.map((candidate) => candidate.endpoint)
    },
    null,
    2
  )
);
