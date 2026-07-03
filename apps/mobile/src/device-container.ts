import { createNearFieldTransportPlan } from "../../../packages/sync-core/src/index.ts";

export type LoginToTerminalKind = "phone" | "tablet";

export interface DeviceContainerCapability {
  id: string;
  label: string;
  status: "preview" | "native-ready" | "planned";
  adapter: string;
}

export interface DeviceContainerProfile {
  kind: LoginToTerminalKind;
  name: string;
  runtime: "browser-preview" | "expo-native";
  formFactor: "phone" | "tablet";
  appWindow: {
    mode: "standalone-window" | "native-screen";
    width: number;
    height: number;
  };
  localOnly: true;
  publicNetworkLogin: false;
  storage: {
    vault: "local-file" | "expo-document-directory";
    runtimeState: "local-file" | "expo-document-directory";
    secureMetadata: "preview-file" | "expo-secure-store";
  };
  syncTransports: Array<"localhost-preview" | "local-network" | "hotspot" | "bluetooth">;
  transportPlan: ReturnType<typeof createNearFieldTransportPlan>;
  capabilities: DeviceContainerCapability[];
  nativeReadiness: {
    requiredAdapters: string[];
    previewAdapters: string[];
    nextNativeAdapters: string[];
  };
}

const baseCapabilities: DeviceContainerCapability[] = [
  {
    id: "local-vault",
    label: "Local encrypted vault files",
    status: "preview",
    adapter: "MobileFileVaultStorageAdapter"
  },
  {
    id: "runtime-state",
    label: "Local runtime state",
    status: "preview",
    adapter: "MobileFileRuntimeStateStorageAdapter"
  },
  {
    id: "secure-metadata",
    label: "Secure metadata boundary",
    status: "native-ready",
    adapter: "ExpoSecureMetadataStore"
  },
  {
    id: "near-field-sync",
    label: "Face-to-face trusted sync",
    status: "preview",
    adapter: "MobileLocalNetworkTransportAdapter"
  }
];

export function createDeviceContainerProfile(kind: LoginToTerminalKind): DeviceContainerProfile {
  const isTablet = kind === "tablet";
  const transportPlan = createNearFieldTransportPlan({
    availableTransports: ["local-network"],
    recommendedTransport: "local-network"
  });
  const captureCapability: DeviceContainerCapability = isTablet
    ? {
      id: "large-screen-review",
      label: "Large-screen review and conflict handling",
      status: "preview",
      adapter: "tablet review shell"
    }
    : {
      id: "camera-capture",
      label: "Camera capture and OCR attachment intake",
      status: "native-ready",
      adapter: "createMobileCameraCaptureSession"
    };

  return {
    kind,
    name: isTablet ? "LoginTo Tablet Container" : "LoginTo Phone Container",
    runtime: "browser-preview",
    formFactor: isTablet ? "tablet" : "phone",
    appWindow: {
      mode: "standalone-window",
      width: isTablet ? 1180 : 430,
      height: isTablet ? 820 : 860
    },
    localOnly: true,
    publicNetworkLogin: false,
    storage: {
      vault: "local-file",
      runtimeState: "local-file",
      secureMetadata: "preview-file"
    },
    syncTransports: ["localhost-preview", "local-network", "hotspot", "bluetooth"],
    transportPlan,
    capabilities: [...baseCapabilities, captureCapability],
    nativeReadiness: {
      requiredAdapters: [
        "vault storage",
        "runtime-state storage",
        "secure metadata",
        "near-field transport",
        isTablet ? "review surface" : "camera capture"
      ],
      previewAdapters: [
        "local-file vault",
        "local-file runtime-state",
        "localhost app window",
        "localhost near-field probe"
      ],
      nextNativeAdapters: [
        "Expo document storage",
        "Expo SecureStore",
        isTablet ? "tablet native navigation shell" : "Expo Camera",
        "LAN/hotspot direct transport"
      ]
    }
  };
}
