const desktopApp = await import("../apps/desktop/scripts/app-state.mjs");
const mobileApp = await import("../apps/mobile/scripts/app-state.mjs");

const desktopDiscovery = await desktopApp.createDesktopShellNearFieldDiscovery({
  scannedAt: "2026-12-20T09:00:00.000Z",
  hosts: ["127.0.0.1"],
  ports: [9],
  timeoutMs: 50
});

if (desktopDiscovery.probes.length !== 2) {
  throw new Error("Expected desktop discovery scan plan to probe phone and tablet products");
}
if (desktopDiscovery.candidates.length !== 0) {
  throw new Error("Expected scan-plan desktop discovery not to create fallback candidates for offline endpoints");
}
if (!desktopDiscovery.advertisedEndpoints.some((endpoint) => endpoint.startsWith("http://127.0.0.1:"))) {
  throw new Error("Expected desktop discovery to expose a loopback advertised endpoint");
}

const mobileDiscovery = await mobileApp.createMobileShellNearFieldDiscovery({
  scannedAt: "2026-06-13T09:41:00.000Z",
  hosts: ["127.0.0.1"],
  ports: [9],
  timeoutMs: 50
});

if (mobileDiscovery.probes.length !== 1) {
  throw new Error("Expected mobile discovery scan plan to probe one desktop target");
}
if (mobileDiscovery.candidates.length !== 0) {
  throw new Error("Expected scan-plan mobile discovery not to create fallback candidates for offline endpoints");
}

console.log("Terminal discovery shell smoke test passed.");
console.log(
  JSON.stringify(
    {
      desktopProbes: desktopDiscovery.probes.length,
      mobileProbes: mobileDiscovery.probes.length,
      desktopChannels: desktopDiscovery.channels.map((channel) => channel.id),
      mobileChannels: mobileDiscovery.channels.map((channel) => channel.id)
    },
    null,
    2
  )
);
