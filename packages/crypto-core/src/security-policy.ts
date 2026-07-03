import type { FieldSensitivity } from "@loginto/vault-core";

export const SENSITIVE_COPY_CLEAR_SECONDS = 30;

export const FIELD_SECURITY_POLICY: Record<FieldSensitivity, {
  hiddenByDefault: boolean;
  searchableByDefault: boolean;
  requiresSecondUnlock: boolean;
}> = {
  public: {
    hiddenByDefault: false,
    searchableByDefault: true,
    requiresSecondUnlock: false
  },
  private: {
    hiddenByDefault: false,
    searchableByDefault: true,
    requiresSecondUnlock: false
  },
  secret: {
    hiddenByDefault: true,
    searchableByDefault: false,
    requiresSecondUnlock: false
  },
  critical: {
    hiddenByDefault: true,
    searchableByDefault: false,
    requiresSecondUnlock: true
  }
};
