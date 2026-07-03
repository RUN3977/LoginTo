const crypto = await import("../packages/crypto-core/src/index.ts");

const security = new crypto.VaultSecuritySession({
  autoLockSeconds: 300,
  secondUnlockSeconds: 60,
  copyClearSeconds: 30,
  now: () => "2026-06-06T19:10:00.000Z"
});

const lockedSecret = security.canRevealField("secret", "2026-06-06T19:10:00.000Z");
if (lockedSecret.canReveal || lockedSecret.reason !== "vault-locked") {
  throw new Error("Expected locked vault to reject secret reveal");
}

security.unlock("2026-06-06T19:10:00.000Z");

const secretDecision = security.canRevealField("secret", "2026-06-06T19:10:01.000Z");
if (!secretDecision.canReveal) {
  throw new Error("Expected unlocked vault to reveal secret fields");
}

const criticalBeforeSecondUnlock = security.canRevealField("critical", "2026-06-06T19:10:02.000Z");
if (criticalBeforeSecondUnlock.canReveal || criticalBeforeSecondUnlock.reason !== "second-unlock-required") {
  throw new Error("Expected critical field to require second unlock");
}

security.unlockCriticalFields("2026-06-06T19:10:03.000Z");
const criticalAfterSecondUnlock = security.canRevealField("critical", "2026-06-06T19:10:04.000Z");
if (!criticalAfterSecondUnlock.canReveal) {
  throw new Error("Expected critical field to reveal after second unlock");
}

const copyPlan = security.planClipboardClear("password", "2026-06-06T19:10:05.000Z");
if (copyPlan.clearAt !== "2026-06-06T19:10:35.000Z") {
  throw new Error(`Expected clipboard clear at 30 seconds, got ${copyPlan.clearAt}`);
}

const criticalAfterExpiry = security.canRevealField("critical", "2026-06-06T19:11:04.000Z");
if (criticalAfterExpiry.canReveal || criticalAfterExpiry.reason !== "second-unlock-required") {
  throw new Error("Expected critical second unlock to expire");
}

const autoLocked = security.refresh("2026-06-06T19:15:06.000Z");
if (autoLocked.lockState !== "locked") {
  throw new Error("Expected vault to auto-lock after inactivity");
}

console.log("Vault security smoke test passed.");
console.log(
  JSON.stringify(
    {
      lockedReason: lockedSecret.reason,
      secretCanReveal: secretDecision.canReveal,
      criticalBefore: criticalBeforeSecondUnlock.reason,
      criticalAfter: criticalAfterSecondUnlock.canReveal,
      copyClearAt: copyPlan.clearAt,
      finalLockState: autoLocked.lockState
    },
    null,
    2
  )
);
