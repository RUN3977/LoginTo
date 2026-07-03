const sync = await import("../packages/sync-core/src/index.ts");

const phoneDevice = {
  id: "device_phone_probe",
  name: "Probe Phone",
  kind: "phone",
  publicKeyBase64: "probe-phone-key"
};

const fetchImpl = async (url) => {
  if (url === "http://127.0.0.1:4177/api/status") {
    return jsonResponse(200, {
      product: "LoginTo mobile shell",
      stage: "probe"
    });
  }
  if (url === "http://127.0.0.1:4177/api/sync/summary") {
    return jsonResponse(200, {
      device: phoneDevice,
      summary: {
        deviceId: phoneDevice.id,
        lastLamport: 7,
        changeCount: 3,
        attachmentCount: 1
      }
    });
  }
  if (url === "http://127.0.0.1:4999/api/status") {
    throw new Error("offline");
  }
  if (url === "http://127.0.0.1:5000/api/status") {
    return jsonResponse(200, {
      product: "Other app",
      stage: "not-loginto"
    });
  }
  throw new Error(`Unexpected probe URL: ${url}`);
};

const success = await sync.probeNearFieldEndpoint({
  target: {
    endpoint: "http://127.0.0.1:4177/",
    transport: "local-network",
    expectedProduct: "LoginTo mobile shell",
    expectedKind: "phone"
  },
  fetchImpl
});

if (!success.reachable || success.device.id !== phoneDevice.id || success.summary.changeCount !== 3) {
  throw new Error("Expected endpoint probe to read reachable LoginTo terminal summary");
}

const plannedTargets = sync.createNearFieldEndpointProbeTargets({
  hosts: ["127.0.0.1", "127.0.0.1", "192.168.1.20"],
  ports: [4177, 4177, 4178],
  expectedProduct: "LoginTo mobile shell",
  expectedKind: "phone",
  maxTargets: 3
});

if (
  plannedTargets.length !== 3
  || plannedTargets[0].endpoint !== "http://127.0.0.1:4177"
  || plannedTargets[1].endpoint !== "http://127.0.0.1:4178"
  || plannedTargets[2].endpoint !== "http://192.168.1.20:4177"
) {
  throw new Error("Expected scan plan to generate deduped endpoint probe targets in order");
}

const transportPlan = sync.createNearFieldTransportPlan({
  availableTransports: ["local-network"],
  recommendedTransport: "local-network"
});
if (transportPlan.publicNetworkLogin !== false || transportPlan.requiresTrustedDevice !== true) {
  throw new Error("Expected near-field transport plan to forbid public-network login and require trusted devices");
}
if (
  transportPlan.recommendedTransport !== "local-network"
  || transportPlan.channels.find((channel) => channel.id === "local-network")?.status !== "available"
  || transportPlan.channels.find((channel) => channel.id === "hotspot")?.status !== "planned"
  || transportPlan.channels.find((channel) => channel.id === "bluetooth")?.requiresFaceToFaceTrust !== true
) {
  throw new Error("Expected near-field transport plan to expose local, hotspot, and bluetooth channel readiness");
}

const hotspotTargets = sync.createHotspotDirectEndpointProbeTargets({
  ports: [4173],
  expectedProduct: "LoginTo desktop shell",
  expectedKind: "desktop",
  maxTargets: 2
});
if (
  hotspotTargets.length !== 2
  || hotspotTargets[0].transport !== "hotspot"
  || hotspotTargets[0].endpoint !== "http://172.20.10.1:4173"
) {
  throw new Error("Expected hotspot direct target plan to use phone hotspot gateway candidates");
}

const snapshot = await sync.createNearFieldDiscoverySnapshotFromProbeTargets({
  localDeviceId: "device_desktop_probe",
  scannedAt: "2026-06-06T10:00:00.000Z",
  trustedDevices: [phoneDevice],
  targets: [
    {
      endpoint: "http://127.0.0.1:4177",
      transport: "local-network",
      expectedProduct: "LoginTo mobile shell",
      expectedKind: "phone"
    },
    {
      endpoint: "http://127.0.0.1:4999",
      transport: "hotspot",
      expectedProduct: "LoginTo tablet shell",
      expectedKind: "tablet",
      includeFallbackCandidate: true,
      fallbackDevice: {
        id: "device_tablet_probe",
        name: "Probe Tablet",
        kind: "tablet",
        publicKeyBase64: "tablet-probe-key"
      }
    },
    {
      endpoint: "http://127.0.0.1:5000",
      transport: "local-network",
      expectedProduct: "LoginTo mobile shell",
      expectedKind: "phone"
    }
  ],
  fetchImpl
});

if (snapshot.probes.length !== 3 || snapshot.probes[1].error !== "offline") {
  throw new Error("Expected probe snapshot to keep failed probe diagnostics");
}
if (snapshot.candidates.length !== 2) {
  throw new Error("Expected reachable and fallback candidates only");
}
if (snapshot.candidates[0].trustStatus !== "trusted" || snapshot.candidates[1].trustStatus !== "needs-pairing") {
  throw new Error("Expected probe snapshot to compute trust status from trusted devices");
}
if (!snapshot.probes[2].error.startsWith("unexpected-product")) {
  throw new Error("Expected product mismatch probe to be reported");
}

console.log("Near-field endpoint probe smoke test passed.");
console.log(
  JSON.stringify(
    {
      reachable: success.reachable,
      recommendedTransport: transportPlan.recommendedTransport,
      plannedTargets: plannedTargets.map((target) => target.endpoint),
      hotspotTargets: hotspotTargets.map((target) => target.endpoint),
      probeErrors: snapshot.probes.map((probe) => probe.error ?? "ok"),
      candidates: snapshot.candidates.map((candidate) => candidate.trustStatus)
    },
    null,
    2
  )
);

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}
