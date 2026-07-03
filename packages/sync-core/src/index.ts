export type DeviceKind = "phone" | "tablet" | "desktop" | "backup";

export type SyncTransport = "local-network" | "hotspot" | "encrypted-package" | "bluetooth";

export type NearFieldTransportChannelStatus = "available" | "planned";

export interface NearFieldTransportChannel {
  id: SyncTransport;
  label: string;
  status: NearFieldTransportChannelStatus;
  adapter: string;
  directOnly: boolean;
  requiresFaceToFaceTrust: boolean;
  publicNetworkLogin: false;
}

export interface NearFieldTransportPlan {
  recommendedTransport: SyncTransport;
  publicNetworkLogin: false;
  requiresTrustedDevice: true;
  channels: NearFieldTransportChannel[];
}

export type SyncOperation = "create" | "update" | "delete" | "archive" | "restore";

export type SyncEntity =
  | "record"
  | "field"
  | "attachment"
  | "reminder"
  | "category"
  | "tag";

export type ConflictStatus = "pending" | "resolved" | "ignored";

export interface DeviceIdentity {
  id: string;
  name: string;
  kind: DeviceKind;
  publicKeyBase64: string;
  trustedAt?: string;
  lastSeenAt?: string;
}

export type NearFieldDiscoveryTrustStatus = "trusted" | "needs-pairing" | "needs-repairing";

export interface NearFieldDiscoveryCandidate {
  id: string;
  device: DeviceIdentity;
  transport: SyncTransport;
  endpoint: string;
  discoveredAt: string;
  trustStatus: NearFieldDiscoveryTrustStatus;
  requiresPairing: boolean;
  requiresRepairing: boolean;
  changeSummary?: SyncSummary;
  lastReceiptAt?: string;
}

export interface NearFieldDiscoverySnapshot {
  localDeviceId: string;
  scannedAt: string;
  candidates: NearFieldDiscoveryCandidate[];
}

export interface NearFieldEndpointProbeTarget {
  endpoint: string;
  transport: SyncTransport;
  expectedProduct?: string;
  expectedKind?: DeviceKind;
  fallbackDevice?: DeviceIdentity;
  includeFallbackCandidate?: boolean;
}

export interface NearFieldScanPlanInput {
  hosts: readonly string[];
  ports: readonly number[];
  transport?: SyncTransport;
  expectedProduct?: string;
  expectedKind?: DeviceKind;
  fallbackDevice?: DeviceIdentity;
  includeFallbackCandidate?: boolean;
  maxTargets?: number;
}

export interface HotspotDirectScanPlanInput {
  ports: readonly number[];
  gatewayHosts?: readonly string[];
  expectedProduct?: string;
  expectedKind?: DeviceKind;
  fallbackDevice?: DeviceIdentity;
  includeFallbackCandidate?: boolean;
  maxTargets?: number;
}

export interface NearFieldEndpointProbe {
  endpoint: string;
  transport: SyncTransport;
  reachable: boolean;
  product?: string;
  stage?: string;
  device?: DeviceIdentity;
  summary?: SyncSummary;
  error?: string;
}

export interface NearFieldDiscoveryProbeSnapshot extends NearFieldDiscoverySnapshot {
  probes: NearFieldEndpointProbe[];
}

export type NearFieldConnectionStage =
  | "idle"
  | "scanning"
  | "connecting"
  | "pairing-required"
  | "repairing-required"
  | "ready"
  | "waiting-confirmation"
  | "waiting-peer"
  | "exchanging"
  | "complete"
  | "timed-out"
  | "peer-rejected"
  | "recovered"
  | "offline"
  | "failed";

export interface NearFieldConnectionStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "failed";
  detail?: string;
}

export interface NearFieldConnectionState {
  stage: NearFieldConnectionStage;
  label: string;
  peerDevice?: DeviceIdentity;
  peerEndpoint?: string;
  transport?: SyncTransport;
  updatedAt?: string;
  requiresFaceToFaceTrust: boolean;
  requiresLocalConfirmation: boolean;
  publicNetworkLogin: false;
  nextAction: "scan" | "pair" | "repair-pairing" | "review-sync" | "retry-sync" | "wait" | "done";
  summary: string;
  steps: NearFieldConnectionStep[];
}

export interface PairingPayload {
  protocol: "loginto-pairing-v1";
  device: DeviceIdentity;
  sessionId: string;
  publicKeyBase64: string;
  localEndpoint?: string;
  expiresAt: string;
}

export function createNearFieldDiscoveryCandidate(input: {
  device: DeviceIdentity;
  transport: SyncTransport;
  endpoint: string;
  discoveredAt: string;
  trustedDevices?: readonly DeviceIdentity[];
  changeSummary?: SyncSummary;
  lastReceiptAt?: string;
}): NearFieldDiscoveryCandidate {
  assertDeviceIdentity(input.device);
  assertSyncTransportValue(input.transport);
  assertNonEmptySyncString(input.endpoint, "endpoint");
  assertIsoSyncDateTime(input.discoveredAt, "discoveredAt");
  if (input.changeSummary) {
    assertSyncSummary(input.changeSummary);
  }
  if (input.lastReceiptAt) {
    assertIsoSyncDateTime(input.lastReceiptAt, "lastReceiptAt");
  }

  const trusted = input.trustedDevices?.find((device) => device.id === input.device.id);
  const trustStatus: NearFieldDiscoveryTrustStatus = !trusted
    ? "needs-pairing"
    : trusted.publicKeyBase64 === input.device.publicKeyBase64
      ? "trusted"
      : "needs-repairing";

  return {
    id: ["near-field", input.transport, input.device.id, createStableDigest(input.endpoint)].join(":"),
    device: { ...input.device },
    transport: input.transport,
    endpoint: input.endpoint,
    discoveredAt: input.discoveredAt,
    trustStatus,
    requiresPairing: trustStatus === "needs-pairing",
    requiresRepairing: trustStatus === "needs-repairing",
    changeSummary: input.changeSummary ? { ...input.changeSummary } : undefined,
    lastReceiptAt: input.lastReceiptAt
  };
}

export function createNearFieldDiscoverySnapshot(input: {
  localDeviceId: string;
  scannedAt: string;
  candidates: readonly NearFieldDiscoveryCandidate[];
}): NearFieldDiscoverySnapshot {
  assertNonEmptySyncString(input.localDeviceId, "localDeviceId");
  assertIsoSyncDateTime(input.scannedAt, "scannedAt");
  return {
    localDeviceId: input.localDeviceId,
    scannedAt: input.scannedAt,
    candidates: [...input.candidates].sort((a, b) =>
      trustStatusRank(a.trustStatus) - trustStatusRank(b.trustStatus)
      || a.device.kind.localeCompare(b.device.kind)
      || a.device.name.localeCompare(b.device.name)
      || a.endpoint.localeCompare(b.endpoint)
    )
  };
}

export async function probeNearFieldEndpoint(input: {
  target: NearFieldEndpointProbeTarget;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<NearFieldEndpointProbe> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const endpoint = normalizeEndpoint(input.target.endpoint);
  try {
    const statusResponse = await fetchImpl(`${endpoint}/api/status`, {
      signal: AbortSignal.timeout(input.timeoutMs ?? 1_000)
    });
    if (!statusResponse.ok) {
      return createFailedEndpointProbe(input.target, `status-${statusResponse.status}`);
    }
    const status = await statusResponse.json() as { product?: string; stage?: string };
    if (input.target.expectedProduct && status.product !== input.target.expectedProduct) {
      return createFailedEndpointProbe(input.target, `unexpected-product:${status.product ?? "unknown"}`, status);
    }
    const summaryResponse = await fetchImpl(`${endpoint}/api/sync/summary`, {
      signal: AbortSignal.timeout(input.timeoutMs ?? 1_000)
    });
    if (!summaryResponse.ok) {
      return createFailedEndpointProbe(input.target, `summary-${summaryResponse.status}`, status);
    }
    const summaryPayload = await summaryResponse.json() as { device?: DeviceIdentity; summary?: SyncSummary };
    if (!summaryPayload.device?.id || !summaryPayload.device.publicKeyBase64 || !summaryPayload.summary) {
      return createFailedEndpointProbe(input.target, "summary-missing-device", status);
    }
    if (input.target.expectedKind && summaryPayload.device.kind !== input.target.expectedKind) {
      return createFailedEndpointProbe(input.target, `unexpected-kind:${summaryPayload.device.kind}`, status);
    }
    return {
      endpoint,
      transport: input.target.transport,
      reachable: true,
      product: status.product,
      stage: status.stage,
      device: { ...summaryPayload.device },
      summary: { ...summaryPayload.summary }
    };
  } catch (error) {
    return createFailedEndpointProbe(input.target, error instanceof Error ? error.message : "unreachable");
  }
}

export async function createNearFieldDiscoverySnapshotFromProbeTargets(input: {
  localDeviceId: string;
  scannedAt: string;
  trustedDevices?: readonly DeviceIdentity[];
  targets: readonly NearFieldEndpointProbeTarget[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<NearFieldDiscoveryProbeSnapshot> {
  const probes = await Promise.all(input.targets.map((target) => probeNearFieldEndpoint({
    target,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs
  })));
  const candidates = probes.flatMap((probe, index) => {
    const target = input.targets[index];
    const device = probe.device ?? (target.includeFallbackCandidate ? target.fallbackDevice : undefined);
    if (!device) {
      return [];
    }
    return [createNearFieldDiscoveryCandidate({
      device,
      trustedDevices: input.trustedDevices,
      transport: target.transport,
      endpoint: probe.endpoint,
      discoveredAt: input.scannedAt,
      changeSummary: probe.summary
    })];
  });
  return {
    ...createNearFieldDiscoverySnapshot({
      localDeviceId: input.localDeviceId,
      scannedAt: input.scannedAt,
      candidates
    }),
    probes
  };
}

export function createNearFieldEndpointProbeTargets(input: NearFieldScanPlanInput): NearFieldEndpointProbeTarget[] {
  const transport = input.transport ?? "local-network";
  assertSyncTransportValue(transport);
  const maxTargets = input.maxTargets ?? 32;
  if (!Number.isInteger(maxTargets) || maxTargets < 1 || maxTargets > 256) {
    throw new Error("maxTargets must be an integer between 1 and 256");
  }
  const targets: NearFieldEndpointProbeTarget[] = [];
  const seen = new Set<string>();
  for (const host of input.hosts) {
    assertNonEmptySyncString(host, "host");
    for (const port of input.ports) {
      assertPort(port);
      const endpoint = `http://${host}:${port}`;
      if (seen.has(endpoint)) {
        continue;
      }
      seen.add(endpoint);
      targets.push({
        endpoint,
        transport,
        expectedProduct: input.expectedProduct,
        expectedKind: input.expectedKind,
        fallbackDevice: input.fallbackDevice,
        includeFallbackCandidate: input.includeFallbackCandidate
      });
      if (targets.length >= maxTargets) {
        return targets;
      }
    }
  }
  return targets;
}

export function createHotspotDirectEndpointProbeTargets(input: HotspotDirectScanPlanInput): NearFieldEndpointProbeTarget[] {
  return createNearFieldEndpointProbeTargets({
    hosts: input.gatewayHosts ?? [
      "172.20.10.1",
      "172.20.10.2",
      "192.168.43.1",
      "192.168.49.1"
    ],
    ports: input.ports,
    transport: "hotspot",
    expectedProduct: input.expectedProduct,
    expectedKind: input.expectedKind,
    fallbackDevice: input.fallbackDevice,
    includeFallbackCandidate: input.includeFallbackCandidate,
    maxTargets: input.maxTargets
  });
}

export function createNearFieldTransportPlan(input: {
  availableTransports?: readonly SyncTransport[];
  recommendedTransport?: SyncTransport;
} = {}): NearFieldTransportPlan {
  const availableTransports = new Set(input.availableTransports ?? ["local-network"]);
  for (const transport of availableTransports) {
    assertSyncTransportValue(transport);
  }
  const recommendedTransport = input.recommendedTransport ?? (availableTransports.has("local-network") ? "local-network" : "hotspot");
  assertSyncTransportValue(recommendedTransport);

  return {
    recommendedTransport,
    publicNetworkLogin: false,
    requiresTrustedDevice: true,
    channels: [
      createNearFieldTransportChannel({
        id: "local-network",
        label: "Local network",
        adapter: "HTTP near-field endpoint probe",
        available: availableTransports.has("local-network")
      }),
      createNearFieldTransportChannel({
        id: "hotspot",
        label: "Phone hotspot",
        adapter: "Hotspot direct endpoint probe",
        available: availableTransports.has("hotspot")
      }),
      createNearFieldTransportChannel({
        id: "bluetooth",
        label: "Bluetooth",
        adapter: "Bluetooth direct exchange adapter",
        available: availableTransports.has("bluetooth")
      })
    ]
  };
}

export function createNearFieldConnectionState(input: {
  discovery?: Partial<NearFieldDiscoveryProbeSnapshot> & {
    transportPlan?: NearFieldTransportPlan;
  };
  pendingConfirmations?: readonly Record<string, unknown>[];
  recentReceipts?: readonly Record<string, unknown>[];
  activeConnection?: Record<string, unknown>;
  now?: string;
} = {}): NearFieldConnectionState {
  const pendingConfirmations = input.pendingConfirmations ?? [];
  const recentReceipts = input.recentReceipts ?? [];
  const probes = input.discovery?.probes ?? [];
  const candidates = input.discovery?.candidates ?? [];
  const latestReceipt = recentReceipts[0];
  const latestFailure = recentReceipts.find((receipt) => receipt.status === "failure");
  const previousFailure = recentReceipts.slice(1).find((receipt) => receipt.status === "failure");
  const pendingConfirmation = pendingConfirmations.at(-1);
  const trustedCandidate = candidates.find((candidate) => candidate.trustStatus === "trusted");
  const repairingCandidate = candidates.find((candidate) => candidate.requiresRepairing || candidate.trustStatus === "needs-repairing");
  const pairingCandidate = candidates.find((candidate) => candidate.requiresPairing || candidate.trustStatus === "needs-pairing");
  const candidate = trustedCandidate ?? repairingCandidate ?? pairingCandidate ?? candidates[0];
  const reachableProbeCount = probes.filter((probe) => probe.reachable).length;
  const scannedAt = input.discovery?.scannedAt;
  const updatedAt = readString(pendingConfirmation?.requestedAt) ?? readString(latestReceipt?.syncedAt) ?? readString(latestReceipt?.receivedAt) ?? scannedAt ?? input.now;

  if (input.activeConnection) {
    const activeStage = readString(input.activeConnection.stage);
    const peerDevice = readDeviceIdentity(input.activeConnection.peerDevice) ?? candidate?.device;
    const transport = readSyncTransport(input.activeConnection.transport) ?? candidate?.transport ?? input.discovery?.transportPlan?.recommendedTransport;
    const peerEndpoint = readString(input.activeConnection.peerEndpoint) ?? candidate?.endpoint;
    const activeUpdatedAt = readString(input.activeConnection.updatedAt) ?? updatedAt;
    if (activeStage === "connecting") {
      return createConnectionState({
        stage: "connecting",
        label: "正在连接对方设备",
        peerDevice,
        peerEndpoint,
        transport,
        updatedAt: activeUpdatedAt,
        nextAction: "wait",
        summary: `${peerDevice?.name ?? "对方设备"} · 正在建立本地直连通道。`,
        activeStep: "discover"
      });
    }
    if (activeStage === "waiting-peer") {
      return createConnectionState({
        stage: "waiting-peer",
        label: "等待对方响应",
        peerDevice,
        peerEndpoint,
        transport,
        updatedAt: activeUpdatedAt,
        nextAction: "wait",
        summary: `${peerDevice?.name ?? "对方设备"} · 已发出请求，等待对方设备响应。`,
        activeStep: "confirm"
      });
    }
    if (activeStage === "exchanging") {
      return createConnectionState({
        stage: "exchanging",
        label: "正在交换加密同步包",
        peerDevice,
        peerEndpoint,
        transport,
        updatedAt: activeUpdatedAt,
        nextAction: "wait",
        requiresLocalConfirmation: false,
        summary: `${peerDevice?.name ?? "对方设备"} · 正在通过本地通道交换加密同步包。`,
        activeStep: "exchange"
      });
    }
  }

  if (latestReceipt && latestReceipt.status !== "failure" && previousFailure && trustedCandidate) {
    return createConnectionState({
      stage: "recovered",
      label: "连接已恢复",
      peerDevice: trustedCandidate.device,
      peerEndpoint: trustedCandidate.endpoint,
      transport: trustedCandidate.transport,
      updatedAt,
      nextAction: "done",
      summary: `${trustedCandidate.device.name} · 最近一次同步成功，已从上次失败中恢复。`,
      activeStep: "done"
    });
  }

  if (latestFailure) {
    const peerName = readString(latestFailure.peerName) ?? readString(latestFailure.receiverName) ?? readString(latestFailure.senderName) ?? candidate?.device.name;
    const recoveryTitle = readString(latestFailure.recoveryTitle) ?? readString(latestFailure.error) ?? "同步失败";
    const failureText = readFailureText(latestFailure);
    const failureReason = readString(latestFailure.failureReason);
    const timedOut = failureReason === "timeout" || /timeout|timed out|AbortError|signal timed out/i.test(failureText);
    const rejected = failureReason === "peer-rejected" || /rejected|declined|denied|cancelled by peer|403|refused by peer/i.test(failureText);
    const offline = failureReason === "target-offline" || /offline|fetch failed|ECONNREFUSED/i.test(failureText);
    const stage: NearFieldConnectionStage = timedOut ? "timed-out" : rejected ? "peer-rejected" : offline ? "offline" : "failed";
    return createConnectionState({
      stage,
      label: timedOut ? "连接超时" : rejected ? "对方拒绝同步" : offline ? "对方设备离线" : "同步需要处理",
      peerDevice: candidate?.device ?? createFallbackConnectionDevice(latestFailure),
      peerEndpoint: readString(latestFailure.targetBaseUrl) ?? candidate?.endpoint,
      transport: readSyncTransport(latestFailure.transport) ?? candidate?.transport ?? input.discovery?.transportPlan?.recommendedTransport,
      updatedAt,
      nextAction: offline ? "scan" : "retry-sync",
      summary: `${peerName ?? "对方设备"} · ${recoveryTitle}`,
      activeStep: "recover",
      failedStep: "exchange"
    });
  }

  if (pendingConfirmation) {
    const peerDevice = readDeviceIdentity(pendingConfirmation.peerDevice) ?? candidate?.device;
    const preview = readRecord(pendingConfirmation.preview);
    const sendChanges = Number(preview?.sendChanges ?? 0);
    const receiveChanges = Number(preview?.receiveChanges ?? 0);
    const conflicts = Number(preview?.conflicts ?? 0);
    return createConnectionState({
      stage: "waiting-confirmation",
      label: "等待确认同步摘要",
      peerDevice,
      peerEndpoint: readString(pendingConfirmation.peerBaseUrl) ?? candidate?.endpoint,
      transport: readSyncTransport(pendingConfirmation.transport) ?? candidate?.transport ?? input.discovery?.transportPlan?.recommendedTransport,
      updatedAt,
      nextAction: "review-sync",
      requiresLocalConfirmation: true,
      summary: `${peerDevice?.name ?? "对方设备"} · 发送 ${sendChanges} · 接收 ${receiveChanges} · 冲突 ${conflicts}`,
      activeStep: "confirm"
    });
  }

  if (repairingCandidate) {
    return createConnectionState({
      stage: "repairing-required",
      label: "需要重新面对面配对",
      peerDevice: repairingCandidate.device,
      peerEndpoint: repairingCandidate.endpoint,
      transport: repairingCandidate.transport,
      updatedAt,
      nextAction: "repair-pairing",
      summary: `${repairingCandidate.device.name} 的设备密钥已变化，重新核对 6 位校验码后才能同步。`,
      activeStep: "pair"
    });
  }

  if (pairingCandidate) {
    return createConnectionState({
      stage: "pairing-required",
      label: "首次连接需要配对",
      peerDevice: pairingCandidate.device,
      peerEndpoint: pairingCandidate.endpoint,
      transport: pairingCandidate.transport,
      updatedAt,
      nextAction: "pair",
      summary: `${pairingCandidate.device.name} 尚未信任，请面对面扫码并确认 6 位校验码。`,
      activeStep: "pair"
    });
  }

  if (trustedCandidate) {
    return createConnectionState({
      stage: latestReceipt && latestReceipt.status !== "failure" ? "complete" : "ready",
      label: latestReceipt && latestReceipt.status !== "failure" ? "最近同步已完成" : "可信设备已就绪",
      peerDevice: trustedCandidate.device,
      peerEndpoint: trustedCandidate.endpoint,
      transport: trustedCandidate.transport,
      updatedAt,
      nextAction: latestReceipt && latestReceipt.status !== "failure" ? "done" : "review-sync",
      summary: latestReceipt && latestReceipt.status !== "failure"
        ? `${trustedCandidate.device.name} · 最近同步成功，下一次仍需确认变更摘要。`
        : `${trustedCandidate.device.name} 在线，确认变更摘要后才会交换加密同步包。`,
      activeStep: latestReceipt && latestReceipt.status !== "failure" ? "done" : "confirm"
    });
  }

  if (probes.length && reachableProbeCount === 0) {
    return createConnectionState({
      stage: "offline",
      label: "未发现可连接设备",
      transport: input.discovery?.transportPlan?.recommendedTransport,
      updatedAt,
      nextAction: "scan",
      summary: "没有连上对方设备，请确认两端在同一局域网或面对面热点中，并重新扫描。",
      activeStep: "discover",
      failedStep: "discover"
    });
  }

  if (probes.length) {
    return createConnectionState({
      stage: "scanning",
      label: "正在扫描近场设备",
      transport: input.discovery?.transportPlan?.recommendedTransport,
      updatedAt,
      nextAction: "wait",
      summary: `已探测 ${probes.length} 个本地端点，发现 ${candidates.length} 个候选设备。`,
      activeStep: "discover"
    });
  }

  return createConnectionState({
    stage: "idle",
    label: "等待近场扫描",
    transport: input.discovery?.transportPlan?.recommendedTransport,
    updatedAt,
    nextAction: "scan",
    summary: "同步只会在本地可通讯设备之间开始，先扫描附近手机、平板或桌面端。",
    activeStep: "discover"
  });
}

function createNearFieldTransportChannel(input: {
  id: SyncTransport;
  label: string;
  adapter: string;
  available: boolean;
}): NearFieldTransportChannel {
  return {
    id: input.id,
    label: input.label,
    status: input.available ? "available" : "planned",
    adapter: input.adapter,
    directOnly: true,
    requiresFaceToFaceTrust: true,
    publicNetworkLogin: false
  };
}

function createConnectionState(input: {
  stage: NearFieldConnectionStage;
  label: string;
  peerDevice?: DeviceIdentity;
  peerEndpoint?: string;
  transport?: SyncTransport;
  updatedAt?: string;
  nextAction: NearFieldConnectionState["nextAction"];
  summary: string;
  requiresLocalConfirmation?: boolean;
  activeStep: "discover" | "pair" | "confirm" | "exchange" | "done" | "recover";
  failedStep?: "discover" | "pair" | "confirm" | "exchange" | "done" | "recover";
}): NearFieldConnectionState {
  return {
    stage: input.stage,
    label: input.label,
    peerDevice: input.peerDevice,
    peerEndpoint: input.peerEndpoint,
    transport: input.transport,
    updatedAt: input.updatedAt,
    requiresFaceToFaceTrust: true,
    requiresLocalConfirmation: input.requiresLocalConfirmation ?? input.activeStep === "confirm",
    publicNetworkLogin: false,
    nextAction: input.nextAction,
    summary: input.summary,
    steps: createConnectionSteps(input.activeStep, input.failedStep)
  };
}

function createConnectionSteps(
  activeStep: "discover" | "pair" | "confirm" | "exchange" | "done" | "recover",
  failedStep?: "discover" | "pair" | "confirm" | "exchange" | "done" | "recover"
): NearFieldConnectionStep[] {
  const order: Array<NearFieldConnectionStep["id"]> = ["discover", "pair", "confirm", "exchange", "done"];
  const labels: Record<string, string> = {
    discover: "发现本地设备",
    pair: "确认可信配对",
    confirm: "确认变更摘要",
    exchange: "交换加密同步包",
    done: "写入本机收据"
  };
  const activeIndex = order.indexOf(activeStep);
  const failedIndex = failedStep ? order.indexOf(failedStep) : -1;
  return order.map((id, index) => {
    const status: NearFieldConnectionStep["status"] = failedIndex === index
      ? "failed"
      : activeStep === "recover" && index === order.length - 1
        ? "failed"
        : index < activeIndex || activeStep === "done"
          ? "done"
          : index === activeIndex
            ? "active"
            : "pending";
    return {
      id,
      label: labels[id],
      status
    };
  });
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readSyncTransport(value: unknown): SyncTransport | undefined {
  return typeof value === "string" && isSyncTransport(value) ? value : undefined;
}

function readFailureText(value: unknown): string {
  const record = readRecord(value);
  return [
    record ? readString(record.failureReason) : undefined,
    record ? readString(record.recoveryTitle) : undefined,
    record ? readString(record.errorDetail) : undefined,
    record ? readString(record.error) : undefined
  ].filter(Boolean).join(" ");
}

function readDeviceIdentity(value: unknown): DeviceIdentity | undefined {
  const record = readRecord(value);
  if (!record) return undefined;
  const id = readString(record.id);
  const name = readString(record.name);
  const kind = record.kind;
  const publicKeyBase64 = readString(record.publicKeyBase64);
  if (!id || !name || !publicKeyBase64 || (kind !== "phone" && kind !== "tablet" && kind !== "desktop" && kind !== "backup")) {
    return undefined;
  }
  return {
    id,
    name,
    kind,
    publicKeyBase64,
    trustedAt: readString(record.trustedAt),
    lastSeenAt: readString(record.lastSeenAt)
  };
}

function createFallbackConnectionDevice(value: unknown): DeviceIdentity | undefined {
  const record = readRecord(value);
  const id = readString(record?.peerDeviceId) ?? readString(record?.receiverDeviceId) ?? readString(record?.senderDeviceId);
  const name = readString(record?.peerName) ?? readString(record?.receiverName) ?? readString(record?.senderName);
  if (!id || !name) return undefined;
  return {
    id,
    name,
    kind: "backup",
    publicKeyBase64: "unknown"
  };
}

export interface PairingVerification {
  sessionId: string;
  localDeviceId: string;
  remoteDeviceId: string;
  sixDigitCode: string;
  verifiedAt?: string;
}

export type PairingSessionStatus =
  | "created"
  | "remote-received"
  | "verified"
  | "trusted"
  | "expired"
  | "cancelled";

export interface PairingSessionSnapshot {
  status: PairingSessionStatus;
  localPayload: PairingPayload;
  remotePayload?: PairingPayload;
  verification?: PairingVerification;
  trustedDevice?: DeviceIdentity;
}

export interface SyncChange {
  id: string;
  entity: SyncEntity;
  entityId: string;
  operation: SyncOperation;
  deviceId: string;
  lamport: number;
  payloadCipher: string;
  createdAt: string;
}

export interface SyncSummary {
  deviceId: string;
  lastLamport: number;
  changeCount: number;
  attachmentCount: number;
}

export interface SyncConflict {
  id: string;
  entity: SyncEntity;
  entityId: string;
  localChangeId: string;
  remoteChangeId: string;
  status: ConflictStatus;
  createdAt: string;
  resolvedAt?: string;
  resolution?: SyncConflictResolution;
  manualMerge?: SyncManualMergeDecision;
}

export type SyncConflictResolution = "use-local" | "use-remote" | "keep-both" | "ignore-remote" | "manual-merge";

export type SyncFieldMergeSource = "local" | "remote";

export interface SyncFieldMergeChoice {
  fieldKey: string;
  source: SyncFieldMergeSource;
  sensitivity?: string;
}

export interface SyncManualMergeDecision {
  fields: SyncFieldMergeChoice[];
}

export interface SyncMergePlan {
  localDeviceId: string;
  remoteDeviceId: string;
  applyRemoteChanges: SyncChange[];
  conflictedRemoteChanges: SyncChange[];
  conflicts: SyncConflict[];
  ignoredRemoteChanges: SyncChange[];
}

export interface SyncExchangePackage {
  protocol: "loginto-sync-exchange-v1";
  packageId: string;
  senderDeviceId: string;
  receiverDeviceId?: string;
  sessionId?: string;
  confirmationId?: string;
  createdAt: string;
  summary: SyncSummary;
  contentDigest: string;
  changes: SyncChange[];
}

export interface SyncCipherPayload {
  profile: string;
  algorithm: string;
  keyPurpose: "sync-session";
  nonceBase64: string;
  ciphertextBase64: string;
  aadBase64?: string;
}

export interface EncryptedSyncExchangePackage {
  protocol: "loginto-encrypted-sync-exchange-v1";
  packageId: string;
  senderDeviceId: string;
  receiverDeviceId?: string;
  sessionId?: string;
  confirmationId?: string;
  createdAt: string;
  contentDigest: string;
  cipher: SyncCipherPayload;
}

export interface BluetoothSyncExchangeEnvelope {
  protocol: "loginto-bluetooth-sync-envelope-v1";
  envelopeId: string;
  transport: "bluetooth";
  senderDevice: DeviceIdentity;
  receiverDevice: DeviceIdentity;
  createdAt: string;
  encryptedPackage: EncryptedSyncExchangePackage;
  packageDigest: string;
  packageBytes: number;
  requiresTrustedDevice: true;
  publicNetworkLogin: false;
}

export interface SyncExchangeCryptoAdapter {
  encrypt(plaintext: Uint8Array, key: Uint8Array, purpose: "sync-session", aad?: Uint8Array): Promise<SyncCipherPayload>;
  decrypt(payload: SyncCipherPayload, key: Uint8Array, aad?: Uint8Array): Promise<Uint8Array>;
}

export type NearFieldEndpointRoute =
  | "/pairing"
  | "/sync/summary"
  | "/sync/exchange"
  | "/sync/apply";

export interface NearFieldEndpointDescriptor {
  protocol: "loginto-near-field-endpoint-v1";
  deviceId: string;
  baseUrl: string;
  routes: Record<NearFieldEndpointRoute, string>;
}

export interface NearFieldRequest<TBody> {
  protocol: "loginto-near-field-request-v1";
  route: NearFieldEndpointRoute;
  requestId: string;
  senderDeviceId: string;
  createdAt: string;
  body: TBody;
}

export interface NearFieldResponse<TBody> {
  protocol: "loginto-near-field-response-v1";
  requestId: string;
  responderDeviceId: string;
  createdAt: string;
  ok: boolean;
  body?: TBody;
  error?: NearFieldError;
}

export interface NearFieldError {
  code: "bad-request" | "not-trusted" | "not-found" | "conflict" | "internal";
  message: string;
}

export interface NearFieldPairingRequestBody {
  pairingPayload: PairingPayload;
}

export interface NearFieldPairingResponseBody {
  localPairingPayload: PairingPayload;
  verification: PairingVerification;
}

export interface NearFieldSummaryRequestBody {
  remoteSummary?: SyncSummary;
}

export interface NearFieldExchangeRequestBody {
  exchangePackage?: SyncExchangePackage;
  encryptedPackage?: EncryptedSyncExchangePackage;
  transport?: SyncTransport;
  decisions?: readonly SyncConflictDecision[];
}

export interface NearFieldApplyRequestBody extends NearFieldExchangeRequestBody {
  decisions: readonly SyncConflictDecision[];
}

export type NearFieldEndpointRequestBody =
  | NearFieldPairingRequestBody
  | NearFieldSummaryRequestBody
  | NearFieldExchangeRequestBody
  | NearFieldApplyRequestBody;

export type NearFieldEndpointResponseBody =
  | NearFieldPairingResponseBody
  | SyncSummary
  | SyncApplyReport;

export interface DetectSyncConflictsInput {
  localChanges: readonly SyncChange[];
  remoteChanges: readonly SyncChange[];
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface CreateSyncMergePlanInput extends DetectSyncConflictsInput {
  localDeviceId: string;
  remoteDeviceId: string;
}

export interface CreateSyncExchangePackageInput {
  senderDeviceId: string;
  receiverDeviceId?: string;
  changes: readonly SyncChange[];
  packageId?: string;
  sessionId?: string;
  confirmationId?: string;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface EncryptSyncExchangePackageInput {
  exchangePackage: SyncExchangePackage;
  adapter: SyncExchangeCryptoAdapter;
  key: Uint8Array;
}

export interface DecryptSyncExchangePackageInput {
  encryptedPackage: EncryptedSyncExchangePackage;
  adapter: SyncExchangeCryptoAdapter;
  key: Uint8Array;
}

export interface CreateBluetoothSyncExchangeEnvelopeInput {
  senderDevice: DeviceIdentity;
  receiverDevice: DeviceIdentity;
  encryptedPackage: EncryptedSyncExchangePackage;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface CreateNearFieldEndpointDescriptorInput {
  deviceId: string;
  baseUrl: string;
}

export interface CreateNearFieldRequestInput<TBody> {
  route: NearFieldEndpointRoute;
  senderDeviceId: string;
  body: TBody;
  requestId?: string;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface CreateNearFieldResponseInput<TBody> {
  requestId: string;
  responderDeviceId: string;
  body?: TBody;
  error?: NearFieldError;
  now?: () => string;
}

export interface HandleNearFieldRequestInput<TBody = NearFieldEndpointRequestBody> {
  session: NearFieldSyncSession;
  request: NearFieldRequest<TBody>;
  pairingPayload?: PairingPayload;
  now?: () => string;
  ids?: SyncIdFactory;
}

export type NearFieldRequestHandler = <TBody>(
  request: NearFieldRequest<TBody>
) => NearFieldResponse<NearFieldEndpointResponseBody> | Promise<NearFieldResponse<NearFieldEndpointResponseBody>>;

export interface NearFieldTransportAdapter {
  send<TRequestBody, TResponseBody>(
    descriptor: NearFieldEndpointDescriptor,
    request: NearFieldRequest<TRequestBody>
  ): Promise<NearFieldResponse<TResponseBody>>;
}

export interface SendNearFieldRequestInput<TRequestBody> {
  transport: NearFieldTransportAdapter;
  descriptor: NearFieldEndpointDescriptor;
  route: NearFieldEndpointRoute;
  senderDeviceId: string;
  body: TRequestBody;
  requestId?: string;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface CreateMergePlanFromExchangeInput {
  localDeviceId: string;
  localChangeLog: SyncChangeLog;
  exchangePackage: SyncExchangePackage;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface NearFieldSyncSessionOptions {
  localDevice: DeviceIdentity;
  trustedDevices?: readonly DeviceIdentity[];
  changes?: readonly SyncChange[];
  imports?: readonly SyncImportEntry[];
}

export interface SyncConflictDecision {
  conflictId: string;
  resolution: SyncConflictResolution;
  manualMerge?: SyncManualMergeDecision;
}

export interface ApplySyncMergePlanInput {
  mergePlan: SyncMergePlan;
  changeLog: SyncChangeLog;
  transport: SyncTransport;
  decisions?: readonly SyncConflictDecision[];
  exchangePackageId?: string;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface SyncApplyReport {
  result: SyncResult;
  appliedChanges: SyncChange[];
  resolvedConflicts: SyncConflict[];
  pendingConflicts: SyncConflict[];
  ignoredRemoteChanges: SyncChange[];
  importEntry: SyncImportEntry;
}

export interface SyncImportEntry {
  id: string;
  remoteDeviceId: string;
  importedAt: string;
  exchangePackageId?: string;
  appliedChangeIds: string[];
  conflictIds: string[];
  ignoredChangeIds: string[];
  failedChangeIds: string[];
}

export interface CreateSyncImportEntryInput {
  remoteDeviceId: string;
  appliedChangeIds: readonly string[];
  conflictIds: readonly string[];
  ignoredChangeIds: readonly string[];
  failedChangeIds: readonly string[];
  exchangePackageId?: string;
  importedAt?: string;
  id?: string;
  ids?: SyncIdFactory;
}

export interface SyncResult {
  transport: SyncTransport;
  remoteDeviceId: string;
  added: number;
  updated: number;
  deleted: number;
  attachmentsTransferred: number;
  conflicts: SyncConflict[];
  failedChangeIds: string[];
}

export const PAIRING_PROTOCOL = "loginto-pairing-v1";

export const SYNC_PROTOCOL = "loginto-sync-v1";

export const SYNC_EXCHANGE_PROTOCOL = "loginto-sync-exchange-v1";

export const NEAR_FIELD_ENDPOINT_PROTOCOL = "loginto-near-field-endpoint-v1";

export const NEAR_FIELD_REQUEST_PROTOCOL = "loginto-near-field-request-v1";

export const NEAR_FIELD_RESPONSE_PROTOCOL = "loginto-near-field-response-v1";

export const NEAR_FIELD_ENDPOINT_ROUTES = [
  "/pairing",
  "/sync/summary",
  "/sync/exchange",
  "/sync/apply"
] as const satisfies readonly NearFieldEndpointRoute[];

export const PAIRING_CODE_DIGITS = 6;

export interface SyncIdFactory {
  nextId(prefix: string): string;
}

export interface CreateDeviceIdentityInput {
  name: string;
  kind: DeviceKind;
  publicKeyBase64: string;
  id?: string;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface CreatePairingPayloadInput {
  device: DeviceIdentity;
  sessionId?: string;
  localEndpoint?: string;
  ttlSeconds?: number;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface FaceToFacePairingSessionOptions {
  localDevice: DeviceIdentity;
  sessionId?: string;
  localEndpoint?: string;
  ttlSeconds?: number;
  now?: () => string;
  ids?: SyncIdFactory;
}

export interface CreateSyncChangeInput {
  entity: SyncEntity;
  entityId: string;
  operation: SyncOperation;
  deviceId: string;
  lamport: number;
  payloadCipher: string;
  createdAt?: string;
  id?: string;
  ids?: SyncIdFactory;
}

export interface TrustDeviceInput {
  device: DeviceIdentity;
  trustedAt?: string;
}

export interface CreateSyncConflictInput {
  localChange: SyncChange;
  remoteChange: SyncChange;
  id?: string;
  now?: () => string;
  ids?: SyncIdFactory;
}

export class SyncChangeLog {
  #changes = new Map<string, SyncChange>();

  constructor(changes: readonly SyncChange[] = []) {
    for (const change of changes) {
      this.append(change);
    }
  }

  append(change: SyncChange): SyncChange {
    const existing = this.#changes.get(change.id);
    if (existing) {
      return existing;
    }
    this.#changes.set(change.id, { ...change });
    return { ...change };
  }

  appendMany(changes: readonly SyncChange[]): SyncChange[] {
    return changes.map((change) => this.append(change));
  }

  list(): SyncChange[] {
    return Array.from(this.#changes.values()).sort(compareSyncChanges);
  }

  listSinceLamport(lamport: number): SyncChange[] {
    return this.list().filter((change) => change.lamport > lamport);
  }

  has(changeId: string): boolean {
    return this.#changes.has(changeId);
  }

  summarize(deviceId: string): SyncSummary {
    return summarizeSyncChanges(this.list(), deviceId);
  }
}

export class SyncImportJournal {
  #entries = new Map<string, SyncImportEntry>();

  constructor(entries: readonly SyncImportEntry[] = []) {
    for (const entry of entries) {
      this.append(entry);
    }
  }

  append(entry: SyncImportEntry): SyncImportEntry {
    const existing = this.#entries.get(entry.id);
    if (existing) {
      return { ...existing, appliedChangeIds: [...existing.appliedChangeIds], conflictIds: [...existing.conflictIds], ignoredChangeIds: [...existing.ignoredChangeIds], failedChangeIds: [...existing.failedChangeIds] };
    }
    const cloned = cloneSyncImportEntry(entry);
    this.#entries.set(entry.id, cloned);
    return cloneSyncImportEntry(cloned);
  }

  list(): SyncImportEntry[] {
    return Array.from(this.#entries.values()).map(cloneSyncImportEntry).sort((a, b) => a.importedAt.localeCompare(b.importedAt) || a.id.localeCompare(b.id));
  }

  lastForRemote(remoteDeviceId: string): SyncImportEntry | undefined {
    return this.list().filter((entry) => entry.remoteDeviceId === remoteDeviceId).at(-1);
  }

  hasImportedChange(changeId: string): boolean {
    return this.list().some((entry) => entry.appliedChangeIds.includes(changeId) || entry.ignoredChangeIds.includes(changeId));
  }

  hasImportedPackage(exchangePackageId: string): boolean {
    return this.list().some((entry) => entry.exchangePackageId === exchangePackageId);
  }
}

export class TrustedDeviceStore {
  #devices = new Map<string, DeviceIdentity>();

  constructor(devices: readonly DeviceIdentity[] = []) {
    for (const device of devices) {
      this.#devices.set(device.id, { ...device });
    }
  }

  trust(input: TrustDeviceInput): DeviceIdentity {
    const trustedAt = input.trustedAt ?? new Date().toISOString();
    const device = {
      ...input.device,
      trustedAt,
      lastSeenAt: input.device.lastSeenAt ?? trustedAt
    };
    this.#devices.set(device.id, device);
    return { ...device };
  }

  updateLastSeen(deviceId: string, lastSeenAt = new Date().toISOString()): DeviceIdentity {
    const device = this.#devices.get(deviceId);
    if (!device) {
      throw new Error(`Trusted device does not exist: ${deviceId}`);
    }
    const updated = { ...device, lastSeenAt };
    this.#devices.set(deviceId, updated);
    return { ...updated };
  }

  revoke(deviceId: string): boolean {
    return this.#devices.delete(deviceId);
  }

  get(deviceId: string): DeviceIdentity | undefined {
    const device = this.#devices.get(deviceId);
    return device ? { ...device } : undefined;
  }

  isTrusted(deviceId: string): boolean {
    return this.#devices.has(deviceId);
  }

  list(): DeviceIdentity[] {
    return Array.from(this.#devices.values()).map((device) => ({ ...device })).sort((a, b) => a.name.localeCompare(b.name));
  }
}

export class FaceToFacePairingSession {
  readonly localDevice: DeviceIdentity;
  readonly localPayload: PairingPayload;
  #remotePayload?: PairingPayload;
  #verification?: PairingVerification;
  #trustedDevice?: DeviceIdentity;
  #status: PairingSessionStatus = "created";
  #now: () => string;

  constructor(options: FaceToFacePairingSessionOptions) {
    this.localDevice = { ...options.localDevice };
    this.#now = options.now ?? (() => new Date().toISOString());
    this.localPayload = createPairingPayload({
      device: this.localDevice,
      sessionId: options.sessionId,
      localEndpoint: options.localEndpoint,
      ttlSeconds: options.ttlSeconds,
      now: this.#now,
      ids: options.ids
    });
  }

  get status(): PairingSessionStatus {
    return this.#status;
  }

  get remotePayload(): PairingPayload | undefined {
    return this.#remotePayload ? clonePairingPayload(this.#remotePayload) : undefined;
  }

  get verification(): PairingVerification | undefined {
    return this.#verification ? { ...this.#verification } : undefined;
  }

  receiveRemotePayload(remotePayload: PairingPayload): PairingVerification {
    this.assertCanReceiveRemote();
    assertPairingPayload(remotePayload);
    if (remotePayload.device.id === this.localDevice.id) {
      throw new Error("Pairing remote device must be different from local device");
    }
    if (isPairingPayloadExpired(remotePayload, this.#now())) {
      this.#status = "expired";
      throw new Error("Pairing remote payload is expired");
    }
    if (isPairingPayloadExpired(this.localPayload, this.#now())) {
      this.#status = "expired";
      throw new Error("Pairing local payload is expired");
    }

    this.#remotePayload = clonePairingPayload(remotePayload);
    this.#verification = createPairingVerification(this.localPayload, remotePayload);
    this.#status = "remote-received";
    return { ...this.#verification };
  }

  markVerified(verifiedAt = this.#now()): PairingVerification {
    if (!this.#verification) {
      throw new Error("Pairing cannot be verified before remote payload is received");
    }
    if (this.#status === "trusted") {
      throw new Error("Pairing device is already trusted");
    }
    if (this.#status === "cancelled" || this.#status === "expired") {
      throw new Error(`Pairing cannot be verified while ${this.#status}`);
    }
    this.#verification = {
      ...this.#verification,
      verifiedAt
    };
    this.#status = "verified";
    return { ...this.#verification };
  }

  confirmTrustedDevice(store: TrustedDeviceStore, trustedAt = this.#now()): DeviceIdentity {
    if (this.#status !== "verified") {
      throw new Error("Pairing must be verified before trusting the remote device");
    }
    if (!this.#remotePayload) {
      throw new Error("Pairing remote payload is missing");
    }
    this.#trustedDevice = store.trust({
      device: this.#remotePayload.device,
      trustedAt
    });
    this.#status = "trusted";
    return { ...this.#trustedDevice };
  }

  cancel(): PairingSessionSnapshot {
    if (this.#status !== "trusted") {
      this.#status = "cancelled";
    }
    return this.snapshot();
  }

  refreshExpiredStatus(now = this.#now()): PairingSessionStatus {
    if (this.#status === "trusted" || this.#status === "cancelled") {
      return this.#status;
    }
    if (isPairingPayloadExpired(this.localPayload, now) || (this.#remotePayload && isPairingPayloadExpired(this.#remotePayload, now))) {
      this.#status = "expired";
    }
    return this.#status;
  }

  snapshot(): PairingSessionSnapshot {
    return {
      status: this.#status,
      localPayload: clonePairingPayload(this.localPayload),
      remotePayload: this.remotePayload,
      verification: this.verification,
      trustedDevice: this.#trustedDevice ? { ...this.#trustedDevice } : undefined
    };
  }

  assertCanReceiveRemote(): void {
    if (this.#status === "trusted") {
      throw new Error("Pairing device is already trusted");
    }
    if (this.#status === "cancelled" || this.#status === "expired") {
      throw new Error(`Pairing cannot receive remote payload while ${this.#status}`);
    }
  }
}

export class NearFieldSyncSession {
  readonly localDevice: DeviceIdentity;
  readonly trustedDevices: TrustedDeviceStore;
  readonly changeLog: SyncChangeLog;
  readonly importJournal: SyncImportJournal;

  constructor(options: NearFieldSyncSessionOptions) {
    this.localDevice = { ...options.localDevice };
    this.trustedDevices = new TrustedDeviceStore(options.trustedDevices);
    this.changeLog = new SyncChangeLog(options.changes);
    this.importJournal = new SyncImportJournal(options.imports);
  }

  trustDevice(device: DeviceIdentity, trustedAt?: string): DeviceIdentity {
    return this.trustedDevices.trust({ device, trustedAt });
  }

  createOutgoingExchangePackage(input: {
    remoteSummary?: SyncSummary;
    receiverDeviceId?: string;
    sessionId?: string;
    confirmationId?: string;
    now?: () => string;
    ids?: SyncIdFactory;
  } = {}): SyncExchangePackage {
    const changes = input.remoteSummary
      ? getChangesForRemote(input.remoteSummary, this.changeLog)
      : this.changeLog.list();
    return createSyncExchangePackage({
      senderDeviceId: this.localDevice.id,
      receiverDeviceId: input.receiverDeviceId,
      sessionId: input.sessionId,
      confirmationId: input.confirmationId,
      changes,
      now: input.now,
      ids: input.ids
    });
  }

  receiveExchangePackage(input: {
    exchangePackage: SyncExchangePackage;
    transport: SyncTransport;
    expectedSessionId?: string;
    expectedConfirmationId?: string;
    decisions?: readonly SyncConflictDecision[];
    now?: () => string;
    ids?: SyncIdFactory;
  }): SyncApplyReport {
    if (input.exchangePackage.receiverDeviceId && input.exchangePackage.receiverDeviceId !== this.localDevice.id) {
      throw new Error(`Sync exchange package is for ${input.exchangePackage.receiverDeviceId}, not ${this.localDevice.id}`);
    }

    if (!this.trustedDevices.isTrusted(input.exchangePackage.senderDeviceId)) {
      throw new Error(`Sync exchange sender is not trusted: ${input.exchangePackage.senderDeviceId}`);
    }

    if (input.expectedSessionId && input.exchangePackage.sessionId !== input.expectedSessionId) {
      throw new Error("Sync exchange session binding mismatch");
    }

    if (input.expectedConfirmationId && input.exchangePackage.confirmationId !== input.expectedConfirmationId) {
      throw new Error("Sync exchange confirmation binding mismatch");
    }

    if (this.importJournal.hasImportedPackage(input.exchangePackage.packageId)) {
      throw new Error(`Sync exchange package was already imported: ${input.exchangePackage.packageId}`);
    }

    const mergePlan = createMergePlanFromExchange({
      localDeviceId: this.localDevice.id,
      localChangeLog: this.changeLog,
      exchangePackage: input.exchangePackage,
      now: input.now,
      ids: input.ids
    });
    const report = applySyncMergePlan({
      mergePlan,
      changeLog: this.changeLog,
      transport: input.transport,
      exchangePackageId: input.exchangePackage.packageId,
      decisions: input.decisions,
      now: input.now,
      ids: input.ids
    });
    this.importJournal.append(report.importEntry);
    this.trustedDevices.updateLastSeen(input.exchangePackage.senderDeviceId, input.exchangePackage.createdAt);
    return report;
  }

  getLocalSummary(): SyncSummary {
    return this.changeLog.summarize(this.localDevice.id);
  }
}

export class InMemoryNearFieldTransportAdapter implements NearFieldTransportAdapter {
  #handlers = new Map<string, NearFieldRequestHandler>();

  registerEndpoint(descriptor: NearFieldEndpointDescriptor, handler: NearFieldRequestHandler): () => void {
    assertNearFieldEndpointDescriptor(descriptor);
    this.#handlers.set(descriptor.deviceId, handler);
    return () => {
      this.#handlers.delete(descriptor.deviceId);
    };
  }

  async send<TRequestBody, TResponseBody>(
    descriptor: NearFieldEndpointDescriptor,
    request: NearFieldRequest<TRequestBody>
  ): Promise<NearFieldResponse<TResponseBody>> {
    assertNearFieldEndpointDescriptor(descriptor);
    assertNearFieldRequest(request);
    const handler = this.#handlers.get(descriptor.deviceId);
    if (!handler) {
      return createNearFieldResponse<TResponseBody>({
        requestId: request.requestId,
        responderDeviceId: descriptor.deviceId,
        error: {
          code: "not-found",
          message: `Near-field endpoint is not registered: ${descriptor.deviceId}`
        }
      });
    }

    try {
      const response = await handler(request);
      assertNearFieldResponse(response);
      if (response.requestId !== request.requestId) {
        throw new Error("Near-field response request id mismatch");
      }
      return response as NearFieldResponse<TResponseBody>;
    } catch (error) {
      return createNearFieldResponse<TResponseBody>({
        requestId: request.requestId,
        responderDeviceId: descriptor.deviceId,
        error: toNearFieldError(error)
      });
    }
  }
}

export function createDeviceIdentity(input: CreateDeviceIdentityInput): DeviceIdentity {
  if (!input.name.trim()) {
    throw new Error("Device name must not be empty");
  }
  if (!input.publicKeyBase64.trim()) {
    throw new Error("Device public key must not be empty");
  }
  const now = input.now ?? (() => new Date().toISOString());
  return {
    id: input.id ?? input.ids?.nextId("device") ?? createSyncLocalId("device"),
    name: input.name.trim(),
    kind: input.kind,
    publicKeyBase64: input.publicKeyBase64,
    lastSeenAt: now()
  };
}

export function createPairingPayload(input: CreatePairingPayloadInput): PairingPayload {
  const now = input.now ?? (() => new Date().toISOString());
  const ttlSeconds = input.ttlSeconds ?? 300;
  const expiresAt = new Date(Date.parse(now()) + ttlSeconds * 1000).toISOString();
  return {
    protocol: PAIRING_PROTOCOL,
    device: input.device,
    sessionId: input.sessionId ?? input.ids?.nextId("pairing") ?? createSyncLocalId("pairing"),
    publicKeyBase64: input.device.publicKeyBase64,
    localEndpoint: input.localEndpoint,
    expiresAt
  };
}

export function createPairingVerification(local: PairingPayload, remote: PairingPayload): PairingVerification {
  assertPairingPayload(local);
  assertPairingPayload(remote);
  const codeInput = [local.sessionId, remote.sessionId, local.device.id, remote.device.id]
    .sort()
    .join(":");
  return {
    sessionId: `${local.sessionId}:${remote.sessionId}`,
    localDeviceId: local.device.id,
    remoteDeviceId: remote.device.id,
    sixDigitCode: createSixDigitCode(codeInput)
  };
}

export function isPairingPayloadExpired(payload: PairingPayload, now: string): boolean {
  assertPairingPayload(payload);
  return Date.parse(payload.expiresAt) <= Date.parse(now);
}

export function assertPairingPayload(payload: PairingPayload): void {
  if (payload.protocol !== PAIRING_PROTOCOL) {
    throw new Error(`Unsupported pairing protocol: ${payload.protocol}`);
  }
  if (!payload.sessionId.trim()) {
    throw new Error("Pairing session id must not be empty");
  }
  if (!payload.publicKeyBase64.trim()) {
    throw new Error("Pairing public key must not be empty");
  }
  if (!Number.isFinite(Date.parse(payload.expiresAt))) {
    throw new Error("Pairing expiresAt must be a valid date-time");
  }
}

export function createSyncChange(input: CreateSyncChangeInput): SyncChange {
  if (input.lamport < 0) {
    throw new Error("Lamport value must not be negative");
  }
  if (!input.payloadCipher.trim()) {
    throw new Error("Sync change payload cipher must not be empty");
  }
  return {
    id: input.id ?? input.ids?.nextId("sync_change") ?? createSyncLocalId("sync_change"),
    entity: input.entity,
    entityId: input.entityId,
    operation: input.operation,
    deviceId: input.deviceId,
    lamport: input.lamport,
    payloadCipher: input.payloadCipher,
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}

export function summarizeSyncChanges(changes: readonly SyncChange[], deviceId: string): SyncSummary {
  const lastLamport = changes.reduce((max, change) => Math.max(max, change.lamport), 0);
  return {
    deviceId,
    lastLamport,
    changeCount: changes.length,
    attachmentCount: changes.filter((change) => change.entity === "attachment").length
  };
}

export function getChangesForRemote(summary: SyncSummary, changeLog: SyncChangeLog): SyncChange[] {
  return changeLog.listSinceLamport(summary.lastLamport);
}

export function createSyncExchangePackage(input: CreateSyncExchangePackageInput): SyncExchangePackage {
  const now = input.now ?? (() => new Date().toISOString());
  const changes = [...input.changes].sort(compareSyncChanges);
  const exchangePackageWithoutDigest = {
    protocol: SYNC_EXCHANGE_PROTOCOL,
    packageId: input.packageId ?? input.ids?.nextId("sync_exchange") ?? createSyncLocalId("sync_exchange"),
    senderDeviceId: input.senderDeviceId,
    receiverDeviceId: input.receiverDeviceId,
    sessionId: input.sessionId,
    confirmationId: input.confirmationId,
    createdAt: now(),
    summary: summarizeSyncChanges(changes, input.senderDeviceId),
    changes
  };
  const exchangePackage: SyncExchangePackage = {
    ...exchangePackageWithoutDigest,
    contentDigest: createSyncExchangeContentDigest(exchangePackageWithoutDigest)
  };
  assertSyncExchangePackage(exchangePackage);
  return exchangePackage;
}

export function serializeSyncExchangePackage(exchangePackage: SyncExchangePackage): string {
  assertSyncExchangePackage(exchangePackage);
  return JSON.stringify(exchangePackage, null, 2);
}

export async function encryptSyncExchangePackage(input: EncryptSyncExchangePackageInput): Promise<EncryptedSyncExchangePackage> {
  assertSyncExchangePackage(input.exchangePackage);
  const envelope = createEncryptedSyncExchangeEnvelope(input.exchangePackage);
  const aad = createEncryptedSyncExchangeAad(envelope);
  const cipher = await input.adapter.encrypt(
    new TextEncoder().encode(serializeSyncExchangePackage(input.exchangePackage)),
    input.key,
    "sync-session",
    aad
  );
  const encryptedPackage: EncryptedSyncExchangePackage = {
    ...envelope,
    cipher
  };
  assertEncryptedSyncExchangePackage(encryptedPackage);
  return encryptedPackage;
}

export async function decryptSyncExchangePackage(input: DecryptSyncExchangePackageInput): Promise<SyncExchangePackage> {
  assertEncryptedSyncExchangePackage(input.encryptedPackage);
  const aad = createEncryptedSyncExchangeAad(input.encryptedPackage);
  const plaintext = await input.adapter.decrypt(input.encryptedPackage.cipher, input.key, aad);
  const exchangePackage = parseSyncExchangePackage(new TextDecoder().decode(plaintext));
  assertEncryptedEnvelopeMatchesExchange(input.encryptedPackage, exchangePackage);
  return exchangePackage;
}

export function createBluetoothSyncExchangeEnvelope(input: CreateBluetoothSyncExchangeEnvelopeInput): BluetoothSyncExchangeEnvelope {
  assertDeviceIdentity(input.senderDevice);
  assertDeviceIdentity(input.receiverDevice);
  assertEncryptedSyncExchangePackage(input.encryptedPackage);
  if (input.encryptedPackage.senderDeviceId !== input.senderDevice.id) {
    throw new Error("Bluetooth envelope sender must match encrypted package sender");
  }
  if (input.encryptedPackage.receiverDeviceId && input.encryptedPackage.receiverDeviceId !== input.receiverDevice.id) {
    throw new Error("Bluetooth envelope receiver must match encrypted package receiver");
  }
  const now = input.now ?? (() => new Date().toISOString());
  const envelope: BluetoothSyncExchangeEnvelope = {
    protocol: "loginto-bluetooth-sync-envelope-v1",
    envelopeId: input.ids?.nextId("bluetooth_envelope") ?? createStableDigest({
      senderDeviceId: input.senderDevice.id,
      receiverDeviceId: input.receiverDevice.id,
      packageId: input.encryptedPackage.packageId
    }),
    transport: "bluetooth",
    senderDevice: { ...input.senderDevice },
    receiverDevice: { ...input.receiverDevice },
    createdAt: now(),
    encryptedPackage: input.encryptedPackage,
    packageDigest: createStableDigest(input.encryptedPackage),
    packageBytes: JSON.stringify(input.encryptedPackage).length,
    requiresTrustedDevice: true,
    publicNetworkLogin: false
  };
  assertBluetoothSyncExchangeEnvelope(envelope);
  return envelope;
}

export function serializeBluetoothSyncExchangeEnvelope(envelope: BluetoothSyncExchangeEnvelope): string {
  assertBluetoothSyncExchangeEnvelope(envelope);
  return JSON.stringify(envelope, null, 2);
}

export function parseBluetoothSyncExchangeEnvelope(json: string): BluetoothSyncExchangeEnvelope {
  const parsed = JSON.parse(json) as BluetoothSyncExchangeEnvelope;
  assertBluetoothSyncExchangeEnvelope(parsed);
  return parsed;
}

export function createEncryptedSyncExchangeAad(encryptedPackage: Omit<EncryptedSyncExchangePackage, "cipher"> | EncryptedSyncExchangePackage): Uint8Array {
  return new TextEncoder().encode(stableStringify({
    protocol: "loginto-encrypted-sync-exchange-v1",
    packageId: encryptedPackage.packageId,
    senderDeviceId: encryptedPackage.senderDeviceId,
    receiverDeviceId: encryptedPackage.receiverDeviceId,
    sessionId: encryptedPackage.sessionId,
    confirmationId: encryptedPackage.confirmationId,
    createdAt: encryptedPackage.createdAt,
    contentDigest: encryptedPackage.contentDigest
  }));
}

export function assertEncryptedSyncExchangePackage(encryptedPackage: EncryptedSyncExchangePackage): void {
  if (encryptedPackage.protocol !== "loginto-encrypted-sync-exchange-v1") {
    throw new Error(`Unsupported encrypted sync exchange protocol: ${encryptedPackage.protocol}`);
  }
  if (!encryptedPackage.packageId.trim()) {
    throw new Error("Encrypted sync exchange package id must not be empty");
  }
  if (!encryptedPackage.senderDeviceId.trim()) {
    throw new Error("Encrypted sync exchange sender device id must not be empty");
  }
  if (!Number.isFinite(Date.parse(encryptedPackage.createdAt))) {
    throw new Error("Encrypted sync exchange createdAt must be a valid date-time");
  }
  if (!encryptedPackage.contentDigest.trim()) {
    throw new Error("Encrypted sync exchange content digest must not be empty");
  }
  if (encryptedPackage.cipher.keyPurpose !== "sync-session") {
    throw new Error("Encrypted sync exchange cipher must use sync-session key purpose");
  }
  if (!encryptedPackage.cipher.ciphertextBase64.trim()) {
    throw new Error("Encrypted sync exchange ciphertext must not be empty");
  }
}

export function assertBluetoothSyncExchangeEnvelope(envelope: BluetoothSyncExchangeEnvelope): void {
  if (envelope.protocol !== "loginto-bluetooth-sync-envelope-v1") {
    throw new Error(`Unsupported Bluetooth sync envelope protocol: ${envelope.protocol}`);
  }
  assertNonEmptySyncString(envelope.envelopeId, "envelopeId");
  if (envelope.transport !== "bluetooth") {
    throw new Error(`Bluetooth sync envelope must use bluetooth transport: ${envelope.transport}`);
  }
  assertDeviceIdentity(envelope.senderDevice);
  assertDeviceIdentity(envelope.receiverDevice);
  assertIsoSyncDateTime(envelope.createdAt, "createdAt");
  assertEncryptedSyncExchangePackage(envelope.encryptedPackage);
  if (envelope.encryptedPackage.senderDeviceId !== envelope.senderDevice.id) {
    throw new Error("Bluetooth envelope sender does not match encrypted package sender");
  }
  if (envelope.encryptedPackage.receiverDeviceId && envelope.encryptedPackage.receiverDeviceId !== envelope.receiverDevice.id) {
    throw new Error("Bluetooth envelope receiver does not match encrypted package receiver");
  }
  if (envelope.packageDigest !== createStableDigest(envelope.encryptedPackage)) {
    throw new Error("Bluetooth envelope package digest mismatch");
  }
  if (envelope.packageBytes !== JSON.stringify(envelope.encryptedPackage).length) {
    throw new Error("Bluetooth envelope package size mismatch");
  }
  if (envelope.requiresTrustedDevice !== true) {
    throw new Error("Bluetooth sync envelope must require a trusted device");
  }
  if (envelope.publicNetworkLogin !== false) {
    throw new Error("Bluetooth sync envelope must not require public-network login");
  }
}

export function createSyncExchangeContentDigest(exchangePackage: Omit<SyncExchangePackage, "contentDigest"> | SyncExchangePackage): string {
  const digestInput = {
    protocol: exchangePackage.protocol,
    packageId: exchangePackage.packageId,
    senderDeviceId: exchangePackage.senderDeviceId,
    receiverDeviceId: exchangePackage.receiverDeviceId,
    sessionId: exchangePackage.sessionId,
    confirmationId: exchangePackage.confirmationId,
    createdAt: exchangePackage.createdAt,
    summary: exchangePackage.summary,
    changes: exchangePackage.changes
  };
  return `fnv1a32:${createStableDigest(digestInput)}`;
}

export function parseSyncExchangePackage(json: string): SyncExchangePackage {
  const parsed = JSON.parse(json) as SyncExchangePackage;
  assertSyncExchangePackage(parsed);
  return parsed;
}

function createEncryptedSyncExchangeEnvelope(exchangePackage: SyncExchangePackage): Omit<EncryptedSyncExchangePackage, "cipher"> {
  return {
    protocol: "loginto-encrypted-sync-exchange-v1",
    packageId: exchangePackage.packageId,
    senderDeviceId: exchangePackage.senderDeviceId,
    receiverDeviceId: exchangePackage.receiverDeviceId,
    sessionId: exchangePackage.sessionId,
    confirmationId: exchangePackage.confirmationId,
    createdAt: exchangePackage.createdAt,
    contentDigest: exchangePackage.contentDigest
  };
}

function assertEncryptedEnvelopeMatchesExchange(
  encryptedPackage: EncryptedSyncExchangePackage,
  exchangePackage: SyncExchangePackage
): void {
  const expected = createEncryptedSyncExchangeEnvelope(exchangePackage);
  for (const key of ["packageId", "senderDeviceId", "receiverDeviceId", "sessionId", "confirmationId", "createdAt", "contentDigest"] as const) {
    if (encryptedPackage[key] !== expected[key]) {
      throw new Error(`Encrypted sync exchange metadata mismatch: ${key}`);
    }
  }
}

export function assertSyncExchangePackage(exchangePackage: SyncExchangePackage): void {
  if (exchangePackage.protocol !== SYNC_EXCHANGE_PROTOCOL) {
    throw new Error(`Unsupported sync exchange protocol: ${exchangePackage.protocol}`);
  }
  if (!exchangePackage.packageId.trim()) {
    throw new Error("Sync exchange package id must not be empty");
  }
  if (!exchangePackage.senderDeviceId.trim()) {
    throw new Error("Sync exchange sender device id must not be empty");
  }
  if (!Number.isFinite(Date.parse(exchangePackage.createdAt))) {
    throw new Error("Sync exchange createdAt must be a valid date-time");
  }
  if (exchangePackage.summary.deviceId !== exchangePackage.senderDeviceId) {
    throw new Error("Sync exchange summary device id must match sender device id");
  }
  if (!exchangePackage.contentDigest?.trim()) {
    throw new Error("Sync exchange content digest must not be empty");
  }
  if (exchangePackage.contentDigest !== createSyncExchangeContentDigest(exchangePackage)) {
    throw new Error("Sync exchange content digest mismatch");
  }
  const changeIds = new Set<string>();
  for (const change of exchangePackage.changes) {
    if (changeIds.has(change.id)) {
      throw new Error(`Duplicate sync exchange change id: ${change.id}`);
    }
    changeIds.add(change.id);
  }
}

export function createMergePlanFromExchange(input: CreateMergePlanFromExchangeInput): SyncMergePlan {
  assertSyncExchangePackage(input.exchangePackage);
  return createSyncMergePlan({
    localDeviceId: input.localDeviceId,
    remoteDeviceId: input.exchangePackage.senderDeviceId,
    localChanges: input.localChangeLog.list(),
    remoteChanges: input.exchangePackage.changes,
    now: input.now,
    ids: input.ids
  });
}

export function createNearFieldEndpointDescriptor(input: CreateNearFieldEndpointDescriptorInput): NearFieldEndpointDescriptor {
  if (!input.deviceId.trim()) {
    throw new Error("Near-field endpoint device id must not be empty");
  }
  if (!input.baseUrl.trim()) {
    throw new Error("Near-field endpoint base URL must not be empty");
  }
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  return {
    protocol: NEAR_FIELD_ENDPOINT_PROTOCOL,
    deviceId: input.deviceId,
    baseUrl,
    routes: {
      "/pairing": `${baseUrl}/pairing`,
      "/sync/summary": `${baseUrl}/sync/summary`,
      "/sync/exchange": `${baseUrl}/sync/exchange`,
      "/sync/apply": `${baseUrl}/sync/apply`
    }
  };
}

export function createNearFieldRequest<TBody>(input: CreateNearFieldRequestInput<TBody>): NearFieldRequest<TBody> {
  const now = input.now ?? (() => new Date().toISOString());
  const request = {
    protocol: NEAR_FIELD_REQUEST_PROTOCOL,
    route: input.route,
    requestId: input.requestId ?? input.ids?.nextId("near_field_request") ?? createSyncLocalId("near_field_request"),
    senderDeviceId: input.senderDeviceId,
    createdAt: now(),
    body: input.body
  };
  assertNearFieldRequest(request);
  return request;
}

export function createNearFieldResponse<TBody>(input: CreateNearFieldResponseInput<TBody>): NearFieldResponse<TBody> {
  const now = input.now ?? (() => new Date().toISOString());
  const response = {
    protocol: NEAR_FIELD_RESPONSE_PROTOCOL,
    requestId: input.requestId,
    responderDeviceId: input.responderDeviceId,
    createdAt: now(),
    ok: !input.error,
    body: input.body,
    error: input.error
  };
  assertNearFieldResponse(response);
  return response;
}

export function assertNearFieldEndpointDescriptor(descriptor: NearFieldEndpointDescriptor): void {
  if (descriptor.protocol !== NEAR_FIELD_ENDPOINT_PROTOCOL) {
    throw new Error(`Unsupported near-field endpoint protocol: ${descriptor.protocol}`);
  }
  if (!descriptor.deviceId.trim()) {
    throw new Error("Near-field endpoint device id must not be empty");
  }
  if (!descriptor.baseUrl.trim()) {
    throw new Error("Near-field endpoint base URL must not be empty");
  }
  const baseUrl = descriptor.baseUrl.replace(/\/+$/, "");
  for (const route of NEAR_FIELD_ENDPOINT_ROUTES) {
    if (descriptor.routes[route] !== `${baseUrl}${route}`) {
      throw new Error(`Near-field endpoint route is invalid: ${route}`);
    }
  }
}

export function assertNearFieldRequest<TBody>(request: NearFieldRequest<TBody>): void {
  if (request.protocol !== NEAR_FIELD_REQUEST_PROTOCOL) {
    throw new Error(`Unsupported near-field request protocol: ${request.protocol}`);
  }
  if (!request.requestId.trim()) {
    throw new Error("Near-field request id must not be empty");
  }
  if (!request.senderDeviceId.trim()) {
    throw new Error("Near-field request sender device id must not be empty");
  }
  if (!isNearFieldEndpointRoute(request.route)) {
    throw new Error(`Unsupported near-field request route: ${request.route}`);
  }
  if (!Number.isFinite(Date.parse(request.createdAt))) {
    throw new Error("Near-field request createdAt must be a valid date-time");
  }
}

export function assertNearFieldResponse<TBody>(response: NearFieldResponse<TBody>): void {
  if (response.protocol !== NEAR_FIELD_RESPONSE_PROTOCOL) {
    throw new Error(`Unsupported near-field response protocol: ${response.protocol}`);
  }
  if (!response.requestId.trim()) {
    throw new Error("Near-field response request id must not be empty");
  }
  if (!response.responderDeviceId.trim()) {
    throw new Error("Near-field response responder device id must not be empty");
  }
  if (!Number.isFinite(Date.parse(response.createdAt))) {
    throw new Error("Near-field response createdAt must be a valid date-time");
  }
  if (response.ok && response.error) {
    throw new Error("Near-field response cannot be ok and contain an error");
  }
  if (!response.ok && !response.error) {
    throw new Error("Near-field error response must contain an error");
  }
}

export function handleNearFieldRequest<TBody = NearFieldEndpointRequestBody>(
  input: HandleNearFieldRequestInput<TBody>
): NearFieldResponse<NearFieldEndpointResponseBody> {
  const now = input.now ?? (() => new Date().toISOString());
  const requestId = input.request.requestId.trim() ? input.request.requestId : "unknown";

  try {
    assertNearFieldRequest(input.request);
    const body = handleNearFieldRoute(input);
    return createNearFieldResponse({
      requestId: input.request.requestId,
      responderDeviceId: input.session.localDevice.id,
      body,
      now
    });
  } catch (error) {
    return createNearFieldResponse({
      requestId,
      responderDeviceId: input.session.localDevice.id,
      error: toNearFieldError(error),
      now
    });
  }
}

export async function sendNearFieldRequest<TRequestBody, TResponseBody = NearFieldEndpointResponseBody>(
  input: SendNearFieldRequestInput<TRequestBody>
): Promise<NearFieldResponse<TResponseBody>> {
  assertNearFieldEndpointDescriptor(input.descriptor);
  const request = createNearFieldRequest({
    route: input.route,
    senderDeviceId: input.senderDeviceId,
    body: input.body,
    requestId: input.requestId,
    now: input.now,
    ids: input.ids
  });
  const response = await input.transport.send<TRequestBody, TResponseBody>(input.descriptor, request);
  assertNearFieldResponse(response);
  if (response.requestId !== request.requestId) {
    throw new Error("Near-field response request id mismatch");
  }
  if (response.responderDeviceId !== input.descriptor.deviceId) {
    throw new Error("Near-field response responder device id mismatch");
  }
  return response;
}

export function applySyncMergePlan(input: ApplySyncMergePlanInput): SyncApplyReport {
  const conflictDecisions = input.decisions ?? [];
  const remoteByChangeId = new Map(input.mergePlan.conflictedRemoteChanges.map((change) => [change.id, change]));
  const now = input.now ?? (() => new Date().toISOString());
  const appliedChanges: SyncChange[] = [];
  const resolvedConflicts: SyncConflict[] = [];
  const pendingConflicts: SyncConflict[] = [];
  const ignoredRemoteChanges: SyncChange[] = [...input.mergePlan.ignoredRemoteChanges];
  const failedChangeIds: string[] = [];

  for (const change of input.mergePlan.applyRemoteChanges) {
    appliedChanges.push(input.changeLog.append(change));
  }

  for (const conflict of input.mergePlan.conflicts) {
    const decision = findSyncConflictDecision(conflictDecisions, conflict);
    const resolution = decision?.resolution;
    if (!resolution) {
      pendingConflicts.push(conflict);
      continue;
    }

    const remoteChange = remoteByChangeId.get(conflict.remoteChangeId);
    if ((resolution === "use-remote" || resolution === "keep-both") && remoteChange) {
      appliedChanges.push(input.changeLog.append(remoteChange));
    } else if (resolution === "use-remote" || resolution === "keep-both") {
      failedChangeIds.push(conflict.remoteChangeId);
    } else if (remoteChange) {
      ignoredRemoteChanges.push(remoteChange);
    }

    resolvedConflicts.push(resolveSyncConflict(conflict, resolution, now(), decision?.manualMerge));
  }

  const importEntry = createSyncImportEntry({
    remoteDeviceId: input.mergePlan.remoteDeviceId,
    appliedChangeIds: appliedChanges.map((change) => change.id),
    conflictIds: [...resolvedConflicts, ...pendingConflicts].map((conflict) => conflict.id),
    ignoredChangeIds: ignoredRemoteChanges.map((change) => change.id),
    failedChangeIds,
    exchangePackageId: input.exchangePackageId,
    importedAt: now(),
    ids: input.ids
  });

  return {
    result: createSyncResult({
      transport: input.transport,
      remoteDeviceId: input.mergePlan.remoteDeviceId,
      appliedChanges,
      pendingConflicts,
      failedChangeIds
    }),
    appliedChanges,
    resolvedConflicts,
    pendingConflicts,
    ignoredRemoteChanges,
    importEntry
  };
}

function findSyncConflictDecision(decisions: readonly SyncConflictDecision[], conflict: SyncConflict): SyncConflictDecision | undefined {
  return decisions.find((decision) => {
    return decision.conflictId === conflict.id || decision.conflictId === `record_conflict_${conflict.entityId}`;
  });
}

export function createSyncImportEntry(input: CreateSyncImportEntryInput): SyncImportEntry {
  return {
    id: input.id ?? input.ids?.nextId("sync_import") ?? createSyncLocalId("sync_import"),
    remoteDeviceId: input.remoteDeviceId,
    importedAt: input.importedAt ?? new Date().toISOString(),
    exchangePackageId: input.exchangePackageId,
    appliedChangeIds: [...input.appliedChangeIds],
    conflictIds: [...input.conflictIds],
    ignoredChangeIds: [...input.ignoredChangeIds],
    failedChangeIds: [...input.failedChangeIds]
  };
}

export function createSyncConflict(input: CreateSyncConflictInput): SyncConflict {
  assertChangesConflict(input.localChange, input.remoteChange);
  const now = input.now ?? (() => new Date().toISOString());
  return {
    id: input.id ?? input.ids?.nextId("sync_conflict") ?? createSyncLocalId("sync_conflict"),
    entity: input.localChange.entity,
    entityId: input.localChange.entityId,
    localChangeId: input.localChange.id,
    remoteChangeId: input.remoteChange.id,
    status: "pending",
    createdAt: now()
  };
}

export function detectSyncConflicts(input: DetectSyncConflictsInput): SyncConflict[] {
  const conflicts = new Map<string, SyncConflict>();
  for (const localChange of input.localChanges) {
    for (const remoteChange of input.remoteChanges) {
      if (!doChangesConflict(localChange, remoteChange)) {
        continue;
      }
      const key = `${localChange.entity}:${localChange.entityId}:${localChange.id}:${remoteChange.id}`;
      conflicts.set(
        key,
        createSyncConflict({
          localChange,
          remoteChange,
          now: input.now,
          ids: input.ids
        })
      );
    }
  }
  return Array.from(conflicts.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function createSyncMergePlan(input: CreateSyncMergePlanInput): SyncMergePlan {
  const conflicts = detectSyncConflicts(input);
  const conflictedRemoteChangeIds = new Set(conflicts.map((conflict) => conflict.remoteChangeId));
  const localChangeIds = new Set(input.localChanges.map((change) => change.id));
  const applyRemoteChanges = input.remoteChanges.filter(
    (change) => !conflictedRemoteChangeIds.has(change.id) && !localChangeIds.has(change.id)
  );
  const conflictedRemoteChanges = input.remoteChanges.filter((change) => conflictedRemoteChangeIds.has(change.id));
  const ignoredRemoteChanges = input.remoteChanges.filter((change) => localChangeIds.has(change.id));

  return {
    localDeviceId: input.localDeviceId,
    remoteDeviceId: input.remoteDeviceId,
    applyRemoteChanges,
    conflictedRemoteChanges,
    conflicts,
    ignoredRemoteChanges
  };
}

export function resolveSyncConflict(
  conflict: SyncConflict,
  resolution: SyncConflictResolution,
  resolvedAt = new Date().toISOString(),
  manualMerge?: SyncManualMergeDecision
): SyncConflict {
  if (conflict.status !== "pending") {
    throw new Error(`Only pending conflicts can be resolved: ${conflict.id}`);
  }

  return {
    ...conflict,
    status: resolution === "ignore-remote" ? "ignored" : "resolved",
    resolvedAt,
    resolution,
    manualMerge: resolution === "manual-merge" ? normalizeManualMergeDecision(manualMerge) : undefined
  };
}

function normalizeManualMergeDecision(manualMerge?: SyncManualMergeDecision): SyncManualMergeDecision {
  const fields = (manualMerge?.fields ?? [])
    .filter((field) => field.fieldKey.trim() && (field.source === "local" || field.source === "remote"))
    .map((field) => ({
      fieldKey: field.fieldKey,
      source: field.source,
      sensitivity: field.sensitivity
    }));
  return { fields };
}

export function doChangesConflict(localChange: SyncChange, remoteChange: SyncChange): boolean {
  if (localChange.id === remoteChange.id) {
    return false;
  }
  if (localChange.deviceId === remoteChange.deviceId) {
    return false;
  }
  if (localChange.entity !== remoteChange.entity || localChange.entityId !== remoteChange.entityId) {
    return false;
  }
  if (localChange.payloadCipher === remoteChange.payloadCipher && localChange.operation === remoteChange.operation) {
    return false;
  }
  return isConflictOperation(localChange.operation) || isConflictOperation(remoteChange.operation);
}

function assertChangesConflict(localChange: SyncChange, remoteChange: SyncChange): void {
  if (!doChangesConflict(localChange, remoteChange)) {
    throw new Error(`Changes do not conflict: ${localChange.id}, ${remoteChange.id}`);
  }
}

function handleNearFieldRoute<TBody>(
  input: HandleNearFieldRequestInput<TBody>
): NearFieldEndpointResponseBody {
  if (input.request.route === "/pairing") {
    if (!input.pairingPayload) {
      throw createNearFieldRouteError("not-found", "Pairing endpoint is not open");
    }
    const body = readNearFieldPairingBody(input.request.body);
    return {
      localPairingPayload: input.pairingPayload,
      verification: createPairingVerification(input.pairingPayload, body.pairingPayload)
    };
  }

  assertTrustedNearFieldSender(input.session, input.request.senderDeviceId);
  input.session.trustedDevices.updateLastSeen(input.request.senderDeviceId, input.request.createdAt);

  if (input.request.route === "/sync/summary") {
    return input.session.getLocalSummary();
  }

  if (input.request.route === "/sync/exchange" || input.request.route === "/sync/apply") {
    const body = readNearFieldExchangeBody(input.request.body);
    if (body.exchangePackage.senderDeviceId !== input.request.senderDeviceId) {
      throw createNearFieldRouteError("bad-request", "Exchange sender must match request sender");
    }
    if (input.request.route === "/sync/apply" && (!body.decisions || body.decisions.length === 0)) {
      throw createNearFieldRouteError("bad-request", "Apply requests must include conflict decisions");
    }
    return input.session.receiveExchangePackage({
      exchangePackage: body.exchangePackage,
      transport: body.transport ?? "local-network",
      decisions: body.decisions,
      now: input.now,
      ids: input.ids
    });
  }

  throw createNearFieldRouteError("not-found", `Near-field route is not implemented: ${input.request.route}`);
}

function assertTrustedNearFieldSender(session: NearFieldSyncSession, senderDeviceId: string): void {
  if (!session.trustedDevices.isTrusted(senderDeviceId)) {
    throw createNearFieldRouteError("not-trusted", `Device is not trusted: ${senderDeviceId}`);
  }
}

function readNearFieldPairingBody(body: unknown): NearFieldPairingRequestBody {
  if (!isRecord(body) || !("pairingPayload" in body)) {
    throw createNearFieldRouteError("bad-request", "Pairing request body must contain pairingPayload");
  }
  const pairingPayload = body.pairingPayload as PairingPayload;
  assertPairingPayload(pairingPayload);
  return { pairingPayload };
}

function readNearFieldExchangeBody(body: unknown): NearFieldExchangeRequestBody {
  if (!isRecord(body) || !("exchangePackage" in body)) {
    throw createNearFieldRouteError("bad-request", "Exchange request body must contain exchangePackage");
  }
  const exchangePackage = body.exchangePackage as SyncExchangePackage;
  assertSyncExchangePackage(exchangePackage);
  return {
    exchangePackage,
    transport: isSyncTransport(body.transport) ? body.transport : undefined,
    decisions: Array.isArray(body.decisions) ? (body.decisions as SyncConflictDecision[]) : undefined
  };
}

function createNearFieldRouteError(code: NearFieldError["code"], message: string): Error & { nearFieldCode: NearFieldError["code"] } {
  const error = new Error(message) as Error & { nearFieldCode: NearFieldError["code"] };
  error.nearFieldCode = code;
  return error;
}

function toNearFieldError(error: unknown): NearFieldError {
  if (isNearFieldRouteError(error)) {
    return {
      code: error.nearFieldCode,
      message: error.message
    };
  }

  const message = error instanceof Error ? error.message : "Unknown near-field endpoint error";
  if (/not trusted/i.test(message)) {
    return { code: "not-trusted", message };
  }
  if (/conflict/i.test(message)) {
    return { code: "conflict", message };
  }
  if (/unsupported|invalid|must|duplicate|empty/i.test(message)) {
    return { code: "bad-request", message };
  }
  return { code: "internal", message };
}

function isNearFieldRouteError(error: unknown): error is Error & { nearFieldCode: NearFieldError["code"] } {
  return error instanceof Error && "nearFieldCode" in error && isNearFieldErrorCode(error.nearFieldCode);
}

function isNearFieldErrorCode(code: unknown): code is NearFieldError["code"] {
  return code === "bad-request" || code === "not-trusted" || code === "not-found" || code === "conflict" || code === "internal";
}

function isNearFieldEndpointRoute(route: string): route is NearFieldEndpointRoute {
  return (NEAR_FIELD_ENDPOINT_ROUTES as readonly string[]).includes(route);
}

function isSyncTransport(transport: unknown): transport is SyncTransport {
  return transport === "local-network" || transport === "hotspot" || transport === "encrypted-package" || transport === "bluetooth";
}

function assertDeviceIdentity(device: DeviceIdentity): void {
  assertNonEmptySyncString(device.id, "device.id");
  assertNonEmptySyncString(device.name, "device.name");
  if (!["phone", "tablet", "desktop", "backup"].includes(device.kind)) {
    throw new Error(`Unsupported device kind: ${device.kind}`);
  }
  assertNonEmptySyncString(device.publicKeyBase64, "device.publicKeyBase64");
}

function assertSyncTransportValue(transport: SyncTransport): void {
  if (!isSyncTransport(transport)) {
    throw new Error(`Unsupported sync transport: ${transport}`);
  }
}

function assertSyncSummary(summary: SyncSummary): void {
  assertNonEmptySyncString(summary.deviceId, "summary.deviceId");
  for (const key of ["lastLamport", "changeCount", "attachmentCount"] as const) {
    if (!Number.isInteger(summary[key]) || summary[key] < 0) {
      throw new Error(`Sync summary ${key} must be a non-negative integer`);
    }
  }
}

function assertNonEmptySyncString(value: string, label: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertIsoSyncDateTime(value: string, label: string): void {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO date-time string`);
  }
}

function assertPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid TCP port: ${port}`);
  }
}

function trustStatusRank(status: NearFieldDiscoveryTrustStatus): number {
  if (status === "trusted") {
    return 0;
  }
  if (status === "needs-repairing") {
    return 1;
  }
  return 2;
}

function normalizeEndpoint(endpoint: string): string {
  assertNonEmptySyncString(endpoint, "endpoint");
  return endpoint.replace(/\/+$/, "");
}

function createFailedEndpointProbe(
  target: NearFieldEndpointProbeTarget,
  error: string,
  status?: { product?: string; stage?: string }
): NearFieldEndpointProbe {
  return {
    endpoint: normalizeEndpoint(target.endpoint),
    transport: target.transport,
    reachable: false,
    product: status?.product,
    stage: status?.stage,
    error
  };
}

function createStableDigest(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export {
  decodePairingPayloadText,
  decodePairingPayloadMatrix,
  encodePairingPayloadQr,
  encodePairingPayloadText,
  encodePairingPayloadMatrix,
  type PairingMatrix,
  type PairingQrCode
} from "./pairing-matrix.ts";

function isConflictOperation(operation: SyncOperation): boolean {
  return operation === "create" || operation === "update" || operation === "delete" || operation === "archive" || operation === "restore";
}

function createSyncResult(input: {
  transport: SyncTransport;
  remoteDeviceId: string;
  appliedChanges: readonly SyncChange[];
  pendingConflicts: readonly SyncConflict[];
  failedChangeIds: readonly string[];
}): SyncResult {
  return {
    transport: input.transport,
    remoteDeviceId: input.remoteDeviceId,
    added: input.appliedChanges.filter((change) => change.operation === "create").length,
    updated: input.appliedChanges.filter((change) => change.operation === "update" || change.operation === "archive" || change.operation === "restore").length,
    deleted: input.appliedChanges.filter((change) => change.operation === "delete").length,
    attachmentsTransferred: input.appliedChanges.filter((change) => change.entity === "attachment").length,
    conflicts: [...input.pendingConflicts],
    failedChangeIds: [...input.failedChangeIds]
  };
}

function cloneSyncImportEntry(entry: SyncImportEntry): SyncImportEntry {
  return {
    ...entry,
    appliedChangeIds: [...entry.appliedChangeIds],
    conflictIds: [...entry.conflictIds],
    ignoredChangeIds: [...entry.ignoredChangeIds],
    failedChangeIds: [...entry.failedChangeIds]
  };
}

function clonePairingPayload(payload: PairingPayload): PairingPayload {
  return {
    ...payload,
    device: { ...payload.device }
  };
}

function createSixDigitCode(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String(Math.abs(hash) % 1_000_000).padStart(PAIRING_CODE_DIGITS, "0");
}

function compareSyncChanges(a: SyncChange, b: SyncChange): number {
  return a.lamport - b.lamport || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function createSyncLocalId(prefix: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}_${randomUuid ? randomUuid.replace(/-/g, "") : Math.random().toString(36).slice(2)}`;
}
