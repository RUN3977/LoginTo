import { rm } from "node:fs/promises";
import { join } from "node:path";

const desktopRuntime = await import("../apps/desktop/src/runtime.ts");
const mobileRuntime = await import("../apps/mobile/src/runtime.ts");
const sync = await import("../packages/sync-core/src/index.ts");

const root = process.cwd();
const vaultPath = join(root, ".tmp", "runtime-security-smoke.vault-snapshot.json");
const now = () => "2026-06-06T19:30:00.000Z";
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

await rm(vaultPath, { force: true });

const desktopDevice = sync.createDeviceIdentity({
  id: "device_desktop_security",
  name: "Security Desktop",
  kind: "desktop",
  publicKeyBase64: "desktop-security-key",
  now,
  ids
});

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_security",
  name: "Security Phone",
  kind: "phone",
  publicKeyBase64: "phone-security-key",
  now,
  ids
});

const desktop = await desktopRuntime.createDesktopRuntime({
  vaultPath,
  password: "runtime-security-password",
  vaultName: "Runtime Security Desktop",
  localDevice: desktopDevice,
  kdfIterations: 20_000,
  now,
  ids
});

const phone = await mobileRuntime.createMobileRuntime({
  password: "runtime-security-password",
  vaultName: "Runtime Security Phone",
  localDevice: phoneDevice,
  kdfIterations: 20_000,
  now,
  ids
});

if (desktop.snapshot().lockState !== "unlocked" || phone.snapshot().lockState !== "unlocked") {
  throw new Error("Expected runtimes to be unlocked immediately after password-derived creation");
}

const criticalBefore = desktop.canRevealField("critical");
if (criticalBefore.canReveal || criticalBefore.reason !== "second-unlock-required") {
  throw new Error("Expected desktop runtime critical reveal to require second unlock");
}

desktop.unlockCriticalFields("2026-06-06T19:30:01.000Z");
const criticalAfter = desktop.canRevealField("critical", "2026-06-06T19:30:02.000Z");
if (!criticalAfter.canReveal) {
  throw new Error("Expected desktop runtime critical reveal after second unlock");
}

const copyPlan = phone.planClipboardClear("password", "2026-06-06T19:30:03.000Z");
if (copyPlan.clearAt !== "2026-06-06T19:30:33.000Z") {
  throw new Error("Expected phone runtime clipboard clear plan");
}

desktop.lock();
phone.lock();

let rejectedDesktopWrite = false;
try {
  await desktop.addRecord({
    type: "custom",
    title: "Locked write",
    values: {
      notes: "should fail"
    }
  });
} catch {
  rejectedDesktopWrite = true;
}

let rejectedMobilePairing = false;
try {
  phone.beginPairing();
} catch {
  rejectedMobilePairing = true;
}

if (!rejectedDesktopWrite || !rejectedMobilePairing) {
  throw new Error("Expected locked runtimes to reject protected operations");
}

console.log("Runtime security smoke test passed.");
console.log(
  JSON.stringify(
    {
      desktopInitialLockState: "unlocked",
      phoneInitialLockState: "unlocked",
      criticalBefore: criticalBefore.reason,
      criticalAfter: criticalAfter.canReveal,
      copyClearAt: copyPlan.clearAt,
      rejectedDesktopWrite,
      rejectedMobilePairing
    },
    null,
    2
  )
);
