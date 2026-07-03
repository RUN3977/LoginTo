import type { FieldSensitivity } from "@loginto/vault-core";
import { FIELD_SECURITY_POLICY, SENSITIVE_COPY_CLEAR_SECONDS } from "./security-policy.ts";

export type VaultLockState = "locked" | "unlocked";

export interface VaultSecuritySessionOptions {
  autoLockSeconds?: number;
  secondUnlockSeconds?: number;
  copyClearSeconds?: number;
  now?: () => string;
}

export interface FieldRevealDecision {
  sensitivity: FieldSensitivity;
  hiddenByDefault: boolean;
  requiresSecondUnlock: boolean;
  canReveal: boolean;
  reason?: "vault-locked" | "second-unlock-required";
}

export interface ClipboardClearPlan {
  fieldKey: string;
  requestedAt: string;
  clearAt: string;
}

export interface VaultSecuritySnapshot {
  lockState: VaultLockState;
  unlockedAt?: string;
  lastActivityAt?: string;
  secondUnlockedUntil?: string;
  autoLockSeconds: number;
  secondUnlockSeconds: number;
  copyClearSeconds: number;
}

export class VaultSecuritySession {
  readonly autoLockSeconds: number;
  readonly secondUnlockSeconds: number;
  readonly copyClearSeconds: number;
  #now: () => string;
  #lockState: VaultLockState = "locked";
  #unlockedAt?: string;
  #lastActivityAt?: string;
  #secondUnlockedUntil?: string;

  constructor(options: VaultSecuritySessionOptions = {}) {
    this.autoLockSeconds = options.autoLockSeconds ?? 300;
    this.secondUnlockSeconds = options.secondUnlockSeconds ?? 60;
    this.copyClearSeconds = options.copyClearSeconds ?? SENSITIVE_COPY_CLEAR_SECONDS;
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  get lockState(): VaultLockState {
    this.refresh();
    return this.#lockState;
  }

  unlock(unlockedAt = this.#now()): VaultSecuritySnapshot {
    this.#lockState = "unlocked";
    this.#unlockedAt = unlockedAt;
    this.#lastActivityAt = unlockedAt;
    return this.snapshot();
  }

  lock(): VaultSecuritySnapshot {
    this.#lockState = "locked";
    this.#unlockedAt = undefined;
    this.#lastActivityAt = undefined;
    this.#secondUnlockedUntil = undefined;
    return this.snapshot();
  }

  touch(activityAt = this.#now()): VaultSecuritySnapshot {
    this.refresh(activityAt);
    if (this.#lockState === "unlocked") {
      this.#lastActivityAt = activityAt;
    }
    return this.snapshot(activityAt);
  }

  unlockCriticalFields(unlockedAt = this.#now()): VaultSecuritySnapshot {
    this.assertUnlocked(unlockedAt);
    this.#secondUnlockedUntil = addSeconds(unlockedAt, this.secondUnlockSeconds);
    this.#lastActivityAt = unlockedAt;
    return this.snapshot(unlockedAt);
  }

  canRevealField(sensitivity: FieldSensitivity, now = this.#now()): FieldRevealDecision {
    this.refresh(now);
    const policy = FIELD_SECURITY_POLICY[sensitivity];
    if (this.#lockState === "locked") {
      return {
        sensitivity,
        hiddenByDefault: policy.hiddenByDefault,
        requiresSecondUnlock: policy.requiresSecondUnlock,
        canReveal: false,
        reason: "vault-locked"
      };
    }
    if (policy.requiresSecondUnlock && !this.hasSecondUnlock(now)) {
      return {
        sensitivity,
        hiddenByDefault: policy.hiddenByDefault,
        requiresSecondUnlock: true,
        canReveal: false,
        reason: "second-unlock-required"
      };
    }
    return {
      sensitivity,
      hiddenByDefault: policy.hiddenByDefault,
      requiresSecondUnlock: policy.requiresSecondUnlock,
      canReveal: true
    };
  }

  planClipboardClear(fieldKey: string, requestedAt = this.#now()): ClipboardClearPlan {
    if (!fieldKey.trim()) {
      throw new Error("Clipboard field key must not be empty");
    }
    this.assertUnlocked(requestedAt);
    return {
      fieldKey,
      requestedAt,
      clearAt: addSeconds(requestedAt, this.copyClearSeconds)
    };
  }

  refresh(now = this.#now()): VaultSecuritySnapshot {
    if (this.#lockState === "unlocked" && this.#lastActivityAt) {
      const expiresAt = addSeconds(this.#lastActivityAt, this.autoLockSeconds);
      if (Date.parse(expiresAt) <= Date.parse(now)) {
        return this.lock();
      }
    }
    if (this.#secondUnlockedUntil && Date.parse(this.#secondUnlockedUntil) <= Date.parse(now)) {
      this.#secondUnlockedUntil = undefined;
    }
    return this.snapshot(now);
  }

  snapshot(now = this.#now()): VaultSecuritySnapshot {
    if (this.#secondUnlockedUntil && Date.parse(this.#secondUnlockedUntil) <= Date.parse(now)) {
      this.#secondUnlockedUntil = undefined;
    }
    return {
      lockState: this.#lockState,
      unlockedAt: this.#unlockedAt,
      lastActivityAt: this.#lastActivityAt,
      secondUnlockedUntil: this.#secondUnlockedUntil,
      autoLockSeconds: this.autoLockSeconds,
      secondUnlockSeconds: this.secondUnlockSeconds,
      copyClearSeconds: this.copyClearSeconds
    };
  }

  private assertUnlocked(now = this.#now()): void {
    this.refresh(now);
    if (this.#lockState !== "unlocked") {
      throw new Error("Vault is locked");
    }
  }

  private hasSecondUnlock(now: string): boolean {
    return Boolean(this.#secondUnlockedUntil && Date.parse(this.#secondUnlockedUntil) > Date.parse(now));
  }
}

function addSeconds(dateTime: string, seconds: number): string {
  if (seconds < 0) {
    throw new Error("Seconds must not be negative");
  }
  return new Date(Date.parse(dateTime) + seconds * 1000).toISOString();
}
