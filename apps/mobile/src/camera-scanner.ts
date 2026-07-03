import type { MobileRuntime } from "./runtime.ts";
import type { MobilePairingRequestResult, ScannedDesktopPairingTarget } from "./pairing-client.ts";

export type MobileCameraPermissionStatus = "granted" | "denied" | "undetermined";

export interface MobileCameraPermission {
  status: MobileCameraPermissionStatus;
  canAskAgain: boolean;
}

export interface MobileQrScanResult {
  type: "qr";
  data: string;
  scannedAt: string;
}

export interface MobileCameraQrScanner {
  requestPermission(): Promise<MobileCameraPermission>;
  scanQrCode(): Promise<MobileQrScanResult>;
}

export interface ScanPairingQrWithCameraInput {
  runtime: MobileRuntime;
  scanner: MobileCameraQrScanner;
  localEndpoint?: string;
  ttlSeconds?: number;
}

export interface MobileCameraPairingResult extends MobilePairingRequestResult {
  scannedTarget: ScannedDesktopPairingTarget;
  scan: MobileQrScanResult;
}

export async function scanPairingQrWithCamera(
  input: ScanPairingQrWithCameraInput
): Promise<MobileCameraPairingResult> {
  const permission = await input.scanner.requestPermission();
  if (permission.status !== "granted") {
    throw new Error(`Camera permission is ${permission.status}`);
  }

  const scan = await input.scanner.scanQrCode();
  assertQrScanResult(scan);
  const pairing = await input.runtime.scanPairingQrAndRequest(scan.data, {
    localEndpoint: input.localEndpoint,
    ttlSeconds: input.ttlSeconds
  });

  return {
    ...pairing,
    scan
  };
}

export function createStaticPairingQrScanner(input: {
  payloadText: string;
  scannedAt?: string;
  permission?: MobileCameraPermission;
}): MobileCameraQrScanner {
  return {
    async requestPermission(): Promise<MobileCameraPermission> {
      return input.permission ?? {
        status: "granted",
        canAskAgain: true
      };
    },

    async scanQrCode(): Promise<MobileQrScanResult> {
      return {
        type: "qr",
        data: input.payloadText,
        scannedAt: input.scannedAt ?? new Date().toISOString()
      };
    }
  };
}

function assertQrScanResult(scan: MobileQrScanResult): void {
  if (scan.type !== "qr") {
    throw new Error(`Unsupported scan result type: ${scan.type}`);
  }
  if (!scan.data.trim()) {
    throw new Error("QR scan result must not be empty");
  }
  if (!Number.isFinite(Date.parse(scan.scannedAt))) {
    throw new Error("QR scan result scannedAt must be an ISO date-time string");
  }
}
