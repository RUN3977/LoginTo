import {
  NearFieldSyncSession,
  type DeviceIdentity,
  type NearFieldSyncSessionOptions
} from "../../../packages/sync-core/src/index.ts";

export function createMobileNearFieldSyncSession(
  options: Omit<NearFieldSyncSessionOptions, "localDevice"> & {
    localDevice: DeviceIdentity & { kind: "phone" | "tablet" };
  }
): NearFieldSyncSession {
  return new NearFieldSyncSession(options);
}
