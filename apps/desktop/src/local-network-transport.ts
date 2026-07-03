import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import {
  createNearFieldResponse,
  type NearFieldEndpointDescriptor,
  type NearFieldEndpointRequestBody,
  type NearFieldEndpointResponseBody,
  type NearFieldRequest,
  type NearFieldResponse,
  type NearFieldSyncSession,
  type NearFieldTransportAdapter,
  type PairingPayload,
  type SyncIdFactory
} from "../../../packages/sync-core/src/index.ts";
import { createDesktopNearFieldEndpoint, type DesktopNearFieldEndpoint } from "./near-field-endpoint.ts";

export interface DesktopLocalNetworkTransportOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface StartDesktopLocalNetworkEndpointInput {
  session: NearFieldSyncSession;
  pairingPayload?: PairingPayload;
  host?: string;
  advertiseHost?: string;
  port?: number;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface DesktopNetworkAddressInfo {
  address: string;
  family: string | number;
  internal: boolean;
}

export interface DesktopLocalNetworkHostScanInput {
  interfaces?: NodeJS.Dict<DesktopNetworkAddressInfo[]>;
  includeLoopback?: boolean;
  neighborRadius?: number;
  maxHosts?: number;
}

export interface DesktopLocalNetworkEndpointServer {
  endpoint: DesktopNearFieldEndpoint;
  descriptor: NearFieldEndpointDescriptor;
  baseUrl: string;
  port: number;
  close(): Promise<void>;
}

export class DesktopLocalNetworkTransportAdapter implements NearFieldTransportAdapter {
  readonly fetchImpl: typeof fetch;
  readonly timeoutMs: number;

  constructor(options: DesktopLocalNetworkTransportOptions = {}) {
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

export async function startDesktopLocalNetworkEndpoint(
  input: StartDesktopLocalNetworkEndpointInput
): Promise<DesktopLocalNetworkEndpointServer> {
  const host = input.host ?? "127.0.0.1";
  let endpoint: DesktopNearFieldEndpoint | undefined;

  const server = createServer(async (request, response) => {
    if (!endpoint) {
      writeJson(response, 503, createNearFieldResponse({
        requestId: "unknown",
        responderDeviceId: input.session.localDevice.id,
        error: {
          code: "internal",
          message: "Near-field endpoint is not ready"
        }
      }));
      return;
    }

    await handleHttpNearFieldRequest(request, response, endpoint, input.session.localDevice.id);
  });

  await listen(server, input.port ?? 0, host);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Desktop local network endpoint did not expose a TCP address");
  }

  const advertisedHost = input.advertiseHost ?? host;
  const baseUrl = `http://${advertisedHost}:${address.port}`;
  endpoint = createDesktopNearFieldEndpoint({
    session: input.session,
    baseUrl,
    pairingPayload: input.pairingPayload,
    now: input.now,
    ids: input.ids
  });

  return {
    endpoint,
    descriptor: endpoint.descriptor,
    baseUrl,
    port: address.port,
    close: () => close(server)
  };
}

export function getDesktopLocalNetworkBaseUrlCandidates(
  port: number,
  interfaces: NodeJS.Dict<DesktopNetworkAddressInfo[]> = networkInterfaces(),
  includeLoopback = true
): string[] {
  if (port < 1 || port > 65_535) {
    throw new Error(`Invalid TCP port: ${port}`);
  }

  const candidates = new Set<string>();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" && address.family !== 4) {
        continue;
      }
      if (address.internal) {
        continue;
      }
      candidates.add(`http://${address.address}:${port}`);
    }
  }

  if (includeLoopback || candidates.size === 0) {
    candidates.add(`http://127.0.0.1:${port}`);
  }

  return Array.from(candidates).sort();
}

export function getDesktopLocalNetworkHostCandidates(input: DesktopLocalNetworkHostScanInput = {}): string[] {
  const interfaces = input.interfaces ?? networkInterfaces();
  const includeLoopback = input.includeLoopback ?? true;
  const neighborRadius = input.neighborRadius ?? 2;
  const maxHosts = input.maxHosts ?? 16;
  if (!Number.isInteger(neighborRadius) || neighborRadius < 0 || neighborRadius > 16) {
    throw new Error("neighborRadius must be an integer between 0 and 16");
  }
  if (!Number.isInteger(maxHosts) || maxHosts < 1 || maxHosts > 128) {
    throw new Error("maxHosts must be an integer between 1 and 128");
  }

  const candidates = new Set<string>();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" && address.family !== 4) {
        continue;
      }
      if (address.internal) {
        continue;
      }
      for (const candidate of createNeighborIpv4Hosts(address.address, neighborRadius)) {
        candidates.add(candidate);
        if (candidates.size >= maxHosts) {
          return Array.from(candidates).sort(sortIpv4Hosts);
        }
      }
    }
  }

  if (includeLoopback || candidates.size === 0) {
    candidates.add("127.0.0.1");
  }

  return Array.from(candidates).sort(sortIpv4Hosts);
}

export function getDesktopLocalNetworkEndpointScanTargets(input: {
  ports: readonly number[];
  interfaces?: NodeJS.Dict<DesktopNetworkAddressInfo[]>;
  includeLoopback?: boolean;
  neighborRadius?: number;
  maxHosts?: number;
}): { hosts: string[]; ports: number[] } {
  const ports = [...input.ports];
  for (const port of ports) {
    if (port < 1 || port > 65_535) {
      throw new Error(`Invalid TCP port: ${port}`);
    }
  }
  return {
    hosts: getDesktopLocalNetworkHostCandidates(input),
    ports
  };
}

function createNeighborIpv4Hosts(address: string, radius: number): string[] {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return [];
  }
  const [a, b, c, d] = parts;
  const hosts = new Set<string>();
  hosts.add(address);
  for (let offset = 1; offset <= radius; offset += 1) {
    if (d - offset > 0) {
      hosts.add([a, b, c, d - offset].join("."));
    }
    if (d + offset < 255) {
      hosts.add([a, b, c, d + offset].join("."));
    }
  }
  return Array.from(hosts);
}

function sortIpv4Hosts(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 4; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return a.localeCompare(b);
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

async function handleHttpNearFieldRequest(
  request: IncomingMessage,
  response: ServerResponse,
  endpoint: DesktopNearFieldEndpoint,
  responderDeviceId: string
): Promise<void> {
  if (request.method !== "POST") {
    writeJson(response, 405, createNearFieldResponse({
      requestId: "unknown",
      responderDeviceId,
      error: {
        code: "bad-request",
        message: "Near-field HTTP endpoint only accepts POST"
      }
    }));
    return;
  }

  try {
    const parsed = JSON.parse(await readBody(request)) as NearFieldRequest<NearFieldEndpointRequestBody>;
    const endpointResponse = endpoint.handleRequest(parsed);
    writeJson(response, endpointResponse.ok ? 200 : statusForNearFieldResponse(endpointResponse), endpointResponse);
  } catch (error) {
    writeJson(response, 400, createNearFieldResponse({
      requestId: "unknown",
      responderDeviceId,
      error: {
        code: "bad-request",
        message: error instanceof Error ? error.message : "Invalid near-field HTTP request"
      }
    }));
  }
}

function statusForNearFieldResponse(response: NearFieldResponse<NearFieldEndpointResponseBody>): number {
  if (response.ok) {
    return 200;
  }
  if (response.error?.code === "not-trusted") {
    return 403;
  }
  if (response.error?.code === "not-found") {
    return 404;
  }
  if (response.error?.code === "conflict") {
    return 409;
  }
  return 400;
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
