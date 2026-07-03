const desktopTransport = await import("../apps/desktop/src/local-network-transport.ts");

const candidates = desktopTransport.getDesktopLocalNetworkBaseUrlCandidates(
  43110,
  {
    "Wi-Fi": [
      {
        address: "192.168.1.20",
        family: "IPv4",
        internal: false
      }
    ],
    Loopback: [
      {
        address: "127.0.0.1",
        family: "IPv4",
        internal: true
      }
    ],
    IPv6: [
      {
        address: "fe80::1",
        family: "IPv6",
        internal: false
      }
    ]
  },
  true
);

if (!candidates.includes("http://192.168.1.20:43110")) {
  throw new Error("Expected LAN IPv4 candidate");
}

if (!candidates.includes("http://127.0.0.1:43110")) {
  throw new Error("Expected loopback candidate when includeLoopback is true");
}

if (candidates.some((candidate) => candidate.includes("fe80"))) {
  throw new Error("Expected IPv6 candidates to be excluded for MVP QR base URLs");
}

const fallback = desktopTransport.getDesktopLocalNetworkBaseUrlCandidates(
  43110,
  {
    Loopback: [
      {
        address: "127.0.0.1",
        family: "IPv4",
        internal: true
      }
    ]
  },
  false
);

if (fallback.length !== 1 || fallback[0] !== "http://127.0.0.1:43110") {
  throw new Error("Expected loopback fallback when no LAN address exists");
}

const hostCandidates = desktopTransport.getDesktopLocalNetworkHostCandidates({
  interfaces: {
    "Wi-Fi": [
      {
        address: "192.168.1.20",
        family: "IPv4",
        internal: false
      }
    ],
    Loopback: [
      {
        address: "127.0.0.1",
        family: "IPv4",
        internal: true
      }
    ],
    IPv6: [
      {
        address: "fe80::1",
        family: "IPv6",
        internal: false
      }
    ]
  },
  neighborRadius: 2,
  includeLoopback: true
});

for (const host of ["192.168.1.18", "192.168.1.19", "192.168.1.20", "192.168.1.21", "192.168.1.22"]) {
  if (!hostCandidates.includes(host)) {
    throw new Error(`Expected LAN host candidate: ${host}`);
  }
}
if (!hostCandidates.includes("127.0.0.1")) {
  throw new Error("Expected loopback host candidate when includeLoopback is true");
}
if (hostCandidates.some((host) => host.includes("fe80"))) {
  throw new Error("Expected IPv6 hosts to be excluded from host candidates");
}

const scanTargets = desktopTransport.getDesktopLocalNetworkEndpointScanTargets({
  ports: [4177, 4178],
  interfaces: {
    Ethernet: [
      {
        address: "10.0.0.5",
        family: 4,
        internal: false
      }
    ]
  },
  neighborRadius: 1,
  includeLoopback: false
});

if (scanTargets.hosts.join(",") !== "10.0.0.4,10.0.0.5,10.0.0.6") {
  throw new Error("Expected endpoint scan targets to use nearby LAN hosts");
}
if (scanTargets.ports.join(",") !== "4177,4178") {
  throw new Error("Expected endpoint scan targets to preserve ports");
}

console.log("Desktop network candidate smoke test passed.");
console.log(
  JSON.stringify(
    {
      candidates,
      fallback,
      hostCandidates,
      scanTargets
    },
    null,
    2
  )
);
