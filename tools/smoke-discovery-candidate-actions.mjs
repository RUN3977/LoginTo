const desktop = await import("../apps/desktop/scripts/app-state.mjs");
const mobile = await import("../apps/mobile/scripts/app-state.mjs");
const tablet = await import("../apps/tablet/scripts/app-state.mjs");

const trustedPhone = {
  id: "candidate_phone_trusted",
  device: {
    id: "device_phone_shell",
    name: "LoginTo Phone Shell",
    kind: "phone",
    publicKeyBase64: "phone-public-key"
  },
  transport: "local-network",
  endpoint: "http://127.0.0.1:4177",
  discoveredAt: "2026-06-29T09:00:00.000Z",
  trustStatus: "trusted",
  requiresPairing: false,
  requiresRepairing: false
};

const newDesktop = {
  id: "candidate_desktop_new",
  device: {
    id: "device_desktop_shell",
    name: "LoginTo Desktop Shell",
    kind: "desktop",
    publicKeyBase64: "desktop-public-key"
  },
  transport: "local-network",
  endpoint: "http://127.0.0.1:4173",
  discoveredAt: "2026-06-29T09:01:00.000Z",
  trustStatus: "needs-pairing",
  requiresPairing: true,
  requiresRepairing: false
};

const changedPhone = {
  ...trustedPhone,
  id: "candidate_phone_changed",
  trustStatus: "needs-repairing",
  requiresPairing: false,
  requiresRepairing: true
};

const desktopTrusted = await desktop.resolveDesktopShellDiscoveryCandidateAction({
  candidate: trustedPhone
});

if (
  desktopTrusted.action !== "sync-preview"
  || desktopTrusted.nextRequest.targetKind !== "phone"
  || desktopTrusted.nextRequest.targetBaseUrl !== trustedPhone.endpoint
  || desktopTrusted.nextRequest.targetDeviceId !== trustedPhone.device.id
) {
  throw new Error("Expected trusted desktop discovery candidate to enter sync preview");
}

const desktopRepair = await desktop.resolveDesktopShellDiscoveryCandidateAction({
  candidate: changedPhone
});

if (desktopRepair.action !== "repair-pairing" || !desktopRepair.pairing?.pairingPayload) {
  throw new Error("Expected changed desktop candidate key to require face-to-face re-pairing");
}

const mobilePair = await mobile.resolveMobileShellDiscoveryCandidateAction({
  candidate: newDesktop
});

if (mobilePair.action !== "pair" || !mobilePair.pairing?.qrPayloadText) {
  throw new Error("Expected untrusted mobile discovery candidate to require pairing");
}

const mobileTrusted = await mobile.resolveMobileShellDiscoveryCandidateAction({
  candidate: {
    ...newDesktop,
    trustStatus: "trusted",
    requiresPairing: false,
    requiresRepairing: false
  }
});

if (
  mobileTrusted.action !== "sync-preview"
  || mobileTrusted.nextRequest.desktopBaseUrl !== newDesktop.endpoint
  || mobileTrusted.nextRequest.desktopDeviceId !== newDesktop.device.id
) {
  throw new Error("Expected trusted mobile discovery candidate to enter sync preview");
}

const tabletPair = await tablet.resolveTabletShellDiscoveryCandidateAction({
  candidate: newDesktop
});

if (tabletPair.action !== "pair") {
  throw new Error("Expected untrusted tablet discovery candidate to require pairing");
}

const tabletTrusted = await tablet.resolveTabletShellDiscoveryCandidateAction({
  candidate: {
    ...newDesktop,
    trustStatus: "trusted",
    requiresPairing: false,
    requiresRepairing: false
  }
});

if (
  tabletTrusted.action !== "sync-preview"
  || tabletTrusted.nextRequest.desktopBaseUrl !== newDesktop.endpoint
  || tabletTrusted.nextRequest.desktopDeviceId !== newDesktop.device.id
) {
  throw new Error("Expected trusted tablet discovery candidate to enter sync preview");
}

console.log("Discovery candidate action smoke passed");
