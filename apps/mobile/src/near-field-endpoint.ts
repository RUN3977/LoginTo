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

export interface MobileNearFieldEndpointOptions {
  session: NearFieldSyncSession;
  baseUrl: string;
  pairingPayload?: PairingPayload;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface MobileNearFieldEndpoint {
  descriptor: NearFieldEndpointDescriptor;
  handleRequest<TBody = NearFieldEndpointRequestBody>(
    request: NearFieldRequest<TBody>
  ): NearFieldResponse<NearFieldEndpointResponseBody>;
}

export function createMobileNearFieldEndpoint(options: MobileNearFieldEndpointOptions): MobileNearFieldEndpoint {
  if (options.session.localDevice.kind !== "phone" && options.session.localDevice.kind !== "tablet") {
    throw new Error(`Mobile near-field endpoint requires a phone or tablet device, got ${options.session.localDevice.kind}`);
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
