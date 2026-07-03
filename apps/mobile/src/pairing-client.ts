import {
  createNearFieldEndpointDescriptor,
  decodePairingPayloadText,
  decodePairingPayloadMatrix,
  isPairingPayloadExpired,
  sendNearFieldRequest,
  type DeviceIdentity,
  type FaceToFacePairingSession,
  type NearFieldEndpointDescriptor,
  type NearFieldPairingResponseBody,
  type NearFieldResponse,
  type NearFieldTransportAdapter,
  type PairingMatrix,
  type PairingPayload,
  type PairingQrCode,
  type PairingVerification,
  type SyncIdFactory,
  type TrustedDeviceStore
} from "../../../packages/sync-core/src/index.ts";
import { createMobilePairingSession } from "./pairing-workflow.ts";

export interface SendMobilePairingRequestInput {
  transport: NearFieldTransportAdapter;
  descriptor: NearFieldEndpointDescriptor;
  localDevice: DeviceIdentity & { kind: "phone" | "tablet" };
  localEndpoint?: string;
  ttlSeconds?: number;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface MobilePairingRequestResult {
  session: FaceToFacePairingSession;
  localPayload: PairingPayload;
  remotePayload: PairingPayload;
  verification: PairingVerification;
  response: NearFieldResponse<NearFieldPairingResponseBody>;
}

export interface ConfirmMobilePairingTrustInput {
  session: FaceToFacePairingSession;
  trustedDevices: TrustedDeviceStore;
  confirmedCode: string;
  trustedAt?: string;
}

export interface ScanDesktopPairingMatrixInput {
  matrix: Pick<PairingMatrix, "size" | "cells">;
  now?: string;
}

export interface ScanDesktopPairingQrInput {
  payloadText: PairingQrCode["payloadText"];
  now?: string;
}

export interface ScannedDesktopPairingTarget {
  pairingPayload: PairingPayload;
  descriptor: NearFieldEndpointDescriptor;
  expiresAt: string;
  deviceName: string;
}

export function scanDesktopPairingMatrix(input: ScanDesktopPairingMatrixInput): ScannedDesktopPairingTarget {
  return createScannedDesktopPairingTarget({
    pairingPayload: decodePairingPayloadMatrix(input.matrix),
    now: input.now
  });
}

export function scanDesktopPairingQr(input: ScanDesktopPairingQrInput): ScannedDesktopPairingTarget {
  return createScannedDesktopPairingTarget({
    pairingPayload: decodePairingPayloadText(input.payloadText),
    now: input.now
  });
}

function createScannedDesktopPairingTarget(input: {
  pairingPayload: PairingPayload;
  now?: string;
}): ScannedDesktopPairingTarget {
  const pairingPayload = input.pairingPayload;
  const now = input.now ?? new Date().toISOString();
  if (pairingPayload.device.kind !== "desktop") {
    throw new Error(`Scanned pairing target must be a desktop device, got ${pairingPayload.device.kind}`);
  }
  if (!pairingPayload.localEndpoint?.trim()) {
    throw new Error("Scanned pairing target must include a local endpoint");
  }
  if (isPairingPayloadExpired(pairingPayload, now)) {
    throw new Error("Scanned pairing target is expired");
  }
  return {
    pairingPayload,
    descriptor: createNearFieldEndpointDescriptor({
      deviceId: pairingPayload.device.id,
      baseUrl: pairingPayload.localEndpoint
    }),
    expiresAt: pairingPayload.expiresAt,
    deviceName: pairingPayload.device.name
  };
}

export async function sendMobilePairingRequest(
  input: SendMobilePairingRequestInput
): Promise<MobilePairingRequestResult> {
  const session = createMobilePairingSession({
    localDevice: input.localDevice,
    localEndpoint: input.localEndpoint,
    ttlSeconds: input.ttlSeconds,
    now: input.now,
    ids: input.ids
  });

  const response = await sendNearFieldRequest<{
    pairingPayload: PairingPayload;
  }, NearFieldPairingResponseBody>({
    transport: input.transport,
    descriptor: input.descriptor,
    route: "/pairing",
    senderDeviceId: input.localDevice.id,
    body: {
      pairingPayload: session.localPayload
    },
    now: input.now,
    ids: input.ids
  });

  if (!response.ok || !response.body) {
    throw new Error(response.error?.message ?? "Mobile pairing request failed");
  }

  const verification = session.receiveRemotePayload(response.body.localPairingPayload);
  if (verification.sixDigitCode !== response.body.verification.sixDigitCode) {
    throw new Error("Pairing verification code mismatch");
  }

  return {
    session,
    localPayload: session.localPayload,
    remotePayload: response.body.localPairingPayload,
    verification,
    response
  };
}

export function confirmMobilePairingTrust(input: ConfirmMobilePairingTrustInput): DeviceIdentity {
  const verification = input.session.verification;
  if (!verification) {
    throw new Error("Pairing cannot be confirmed before verification is available");
  }
  if (input.confirmedCode !== verification.sixDigitCode) {
    throw new Error("Pairing code does not match");
  }
  input.session.markVerified(input.trustedAt);
  return input.session.confirmTrustedDevice(input.trustedDevices, input.trustedAt);
}
