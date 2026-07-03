import {
  createNearFieldResponse,
  createHotspotDirectEndpointProbeTargets
} from "../../../packages/sync-core/src/index.ts";
import type {
  DeviceKind,
  NearFieldEndpointDescriptor,
  NearFieldRequest,
  NearFieldResponse,
  NearFieldEndpointProbeTarget,
  NearFieldTransportAdapter
} from "../../../packages/sync-core/src/index.ts";

export interface MobileLocalNetworkTransportOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class MobileLocalNetworkTransportAdapter implements NearFieldTransportAdapter {
  readonly fetchImpl: typeof fetch;
  readonly timeoutMs: number;

  constructor(options: MobileLocalNetworkTransportOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async send<TRequestBody, TResponseBody>(
    descriptor: NearFieldEndpointDescriptor,
    request: NearFieldRequest<TRequestBody>
  ): Promise<NearFieldResponse<TResponseBody>> {
    try {
      const response = await this.fetchImpl(descriptor.routes[request.route], {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      return await readNearFieldHttpResponse(response, descriptor, request);
    } catch (error) {
      return createNearFieldResponse<TResponseBody>({
        requestId: request.requestId,
        responderDeviceId: descriptor.deviceId,
        error: {
          code: "internal",
          message: `Near-field transport failed: ${error instanceof Error ? error.message : "unknown network error"}`
        }
      });
    }
  }
}

export interface MobileHotspotDirectTransportOptions extends MobileLocalNetworkTransportOptions {
  gatewayHosts?: readonly string[];
}

export class MobileHotspotDirectTransportAdapter extends MobileLocalNetworkTransportAdapter {
  readonly gatewayHosts: readonly string[];

  constructor(options: MobileHotspotDirectTransportOptions = {}) {
    super(options);
    this.gatewayHosts = options.gatewayHosts ?? [
      "172.20.10.1",
      "172.20.10.2",
      "192.168.43.1",
      "192.168.49.1"
    ];
  }

  createProbeTargets(input: {
    ports: readonly number[];
    expectedProduct?: string;
    expectedKind?: DeviceKind;
    maxTargets?: number;
  }): NearFieldEndpointProbeTarget[] {
    return createHotspotDirectEndpointProbeTargets({
      gatewayHosts: this.gatewayHosts,
      ports: input.ports,
      expectedProduct: input.expectedProduct,
      expectedKind: input.expectedKind,
      maxTargets: input.maxTargets
    });
  }
}

async function readNearFieldHttpResponse<TResponseBody>(
  response: Response,
  descriptor: NearFieldEndpointDescriptor,
  request: NearFieldRequest<unknown>
): Promise<NearFieldResponse<TResponseBody>> {
  const text = await response.text();
  if (!text.trim()) {
    return createNearFieldResponse<TResponseBody>({
      requestId: request.requestId,
      responderDeviceId: descriptor.deviceId,
      error: {
        code: "internal",
        message: `Near-field endpoint returned an empty HTTP ${response.status} response`
      }
    });
  }
  try {
    return JSON.parse(text) as NearFieldResponse<TResponseBody>;
  } catch {
    return createNearFieldResponse<TResponseBody>({
      requestId: request.requestId,
      responderDeviceId: descriptor.deviceId,
      error: {
        code: "internal",
        message: `Near-field endpoint returned non-JSON HTTP ${response.status} response`
      }
    });
  }
}
