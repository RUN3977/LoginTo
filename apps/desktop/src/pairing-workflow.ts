import {
  FaceToFacePairingSession,
  type DeviceIdentity,
  type FaceToFacePairingSessionOptions
} from "../../../packages/sync-core/src/index.ts";

export function createDesktopPairingSession(
  options: Omit<FaceToFacePairingSessionOptions, "localDevice"> & {
    localDevice: DeviceIdentity & { kind: "desktop" };
  }
): FaceToFacePairingSession {
  return new FaceToFacePairingSession(options);
}
