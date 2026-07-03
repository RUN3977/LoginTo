import {
  NearFieldSyncSession,
  type DeviceIdentity,
  type NearFieldSyncSessionOptions
} from "../../../packages/sync-core/src/index.ts";

export function createDesktopNearFieldSyncSession(
  options: Omit<NearFieldSyncSessionOptions, "localDevice"> & {
    localDevice: DeviceIdentity & { kind: "desktop" };
  }
): NearFieldSyncSession {
  return new NearFieldSyncSession(options);
}
