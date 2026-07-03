import {
  FaceToFacePairingSession,
  type DeviceIdentity,
  type FaceToFacePairingSessionOptions
} from "../../../packages/sync-core/src/index.ts";

export function createMobilePairingSession(
  options: Omit<FaceToFacePairingSessionOptions, "localDevice"> & {
    localDevice: DeviceIdentity & { kind: "phone" | "tablet" };
  }
): FaceToFacePairingSession {
  return new FaceToFacePairingSession(options);
}
