import {
  createNearFieldEndpointDescriptor,
  handleNearFieldRequest,
  type NearFieldEndpointDescriptor,
  type NearFieldEndpointRequestBody,
  type NearFieldEndpointResponseBody,
  type NearFieldRequest,
  type NearFieldResponse,
  type NearFieldSyncSession,
  type PairingPayload,
  type SyncIdFactory
} from "../../../packages/sync-core/src/index.ts";

export interface DesktopNearFieldEndpointOptions {
  session: NearFieldSyncSession;
  baseUrl: string;
  pairingPayload?: PairingPayload;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface DesktopNearFieldEndpoint {
  descriptor: NearFieldEndpointDescriptor;
  handleRequest<TBody = NearFieldEndpointRequestBody>(
    request: NearFieldRequest<TBody>
  ): NearFieldResponse<NearFieldEndpointResponseBody>;
}

export function createDesktopNearFieldEndpoint(options: DesktopNearFieldEndpointOptions): DesktopNearFieldEndpoint {
  if (options.session.localDevice.kind !== "desktop") {
    throw new Error(`Desktop near-field endpoint requires a desktop device, got ${options.session.localDevice.kind}`);
  }

  const descriptor = createNearFieldEndpointDescriptor({
    deviceId: options.session.localDevice.id,
    baseUrl: options.baseUrl
  });

  return {
    descriptor,
    handleRequest(request) {
      return handleNearFieldRequest({
        session: options.session,
        request,
        pairingPayload: options.pairingPayload,
        now: options.now,
        ids: options.ids
      });
    }
  };
}
