import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const crypto = await import("../../../packages/crypto-core/src/index.ts");
const sync = await import("../../../packages/sync-core/src/index.ts");
const vault = await import("../../../packages/vault-core/src/index.ts");
const mobileFileStorage = await import("../../mobile/src/file-vault-storage.ts");
const mobileRuntime = await import("../../mobile/src/runtime.ts");
const mobileRuntimeState = await import("../../mobile/src/runtime-state-storage.ts");
const mobileView = await import("../../mobile/src/view-state.ts");
const deviceContainer = await import("../../mobile/src/device-container.ts");

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const workspaceRoot = normalize(join(__dirname, "..", "..", ".."));
export const tabletRoot = normalize(join(__dirname, ".."));
export const publicRoot = join(tabletRoot, "prototype");
export const defaultVaultPath = join(workspaceRoot, ".tmp", "tablet-shell-preview.vault-snapshot.json");
export const defaultRuntimeStatePath = mobileRuntimeState.createDefaultMobileRuntimeStatePath(defaultVaultPath);
const defaultSyncReceiptPath = join(workspaceRoot, ".tmp", "tablet-sync-receipts.json");
const defaultDeviceIdentityPath = join(workspaceRoot, ".tmp", "tablet-shell-preview.device-identity.json");
const defaultSyncConfirmationPath = join(workspaceRoot, ".tmp", "tablet-sync-confirmations.json");
const defaultTrustedDeviceRevocationPath = join(workspaceRoot, ".tmp", "tablet-trusted-device-revocations.json");
const defaultBackupPackagePath = join(workspaceRoot, ".tmp", "tablet-shell-preview.backup-package.json");

const now = () => "2026-06-25T09:00:00.000Z";
const password = "tablet-shell-preview-password";
const saltBase64 = Buffer.alloc(16).toString("base64");

async function writeJsonFileAtomically(path, payload) {
  const text = JSON.stringify(payload, null, 2);
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  try {
    await writeFile(tempPath, text, "utf8");
    JSON.parse(await readFile(tempPath, "utf8"));
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function writeTextFileAtomically(path, text, verify) {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  try {
    await writeFile(tempPath, text, "utf8");
    if (verify) {
      verify(await readFile(tempPath, "utf8"));
    }
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

function createBackupPackageSummary(backupPackage, packageJson, recordCount) {
  return {
    format: backupPackage.format,
    packageId: backupPackage.packageId,
    vaultId: backupPackage.vaultId,
    sourceDeviceId: backupPackage.sourceDeviceId,
    createdAt: backupPackage.createdAt,
    records: recordCount,
    attachments: backupPackage.attachments.length,
    bytes: Buffer.byteLength(packageJson, "utf8")
  };
}

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_tablet_${Date.now().toString(36)}_${this.value}`;
  }
};
let tabletShellRuntimePromise;

const seedRecords = [
  {
    type: "membership",
    title: "Airport Lounge VIP",
    values: {
      member_name: "Airport Lounge VIP",
      member_id: "LOUNGE-2026",
      expires_at: "2026-11-26T00:00:00.000Z",
      service_phone: "400-555-0101"
    },
    reminderDrafts: [
      {
        dueAt: "2026-11-26T00:00:00.000Z",
        message: "Airport Lounge VIP membership expires soon",
        daysBefore: 14
      }
    ],
    favorite: true
  },
  {
    type: "identity_document",
    title: "Passport",
    values: {
      document_type: "Passport",
      document_number: "E12345678",
      expires_at: "2028-09-12T00:00:00.000Z",
      issued_by: "Exit & Entry Administration",
      notes: "Photo attachment needs a visual review on tablet."
    },
    reminderDrafts: [
      {
        dueAt: "2028-09-12T09:00:00.000Z",
        message: "Passport will expire",
        daysBefore: 30
      }
    ]
  },
  {
    type: "bank_card",
    title: "Family Backup Card",
    values: {
      cardholder: "Zhang",
      card_number: "6225 8800 0000 0826",
      bank_name: "Travel Bank",
      statement_day: "25",
      notes: "Shared family backup card; CVV is not stored."
    },
    reminderDrafts: [
      {
        dueAt: "2026-06-25T09:00:00.000Z",
        message: "Family Backup Card statement day",
        daysBefore: 0
      }
    ]
  },
  {
    type: "account",
    title: "Home Router Admin",
    values: {
      username: "admin",
      password: "router-secret-2026",
      url: "http://192.168.1.1",
      notes: "Review on tablet before syncing to phone."
    }
  }
];

export async function createTabletShellAppState(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const viewState = mobileView.buildMobileVaultViewState(runtime.repository, {
    query: "",
    now: now()
  });
  await hydrateTabletNotesPreview(runtime, viewState);
  const dueNotifications = await runtime.collectDueReminderNotifications(now());
  const notificationState = runtime.reminderNotifications.snapshot(now());
  const reviewQueue = createReviewQueue(viewState);
  const syncReceipts = await loadSyncReceipts();
  const trustedDeviceRevocations = await loadTrustedDeviceRevocations();
  const syncPanel = createTabletSyncPanel(
    runtime,
    syncReceipts,
    await loadSyncConfirmations(),
    await createTabletShellNearFieldDiscoveryFromRuntime(runtime, { syncReceipts }),
    trustedDeviceRevocations
  );
  const selectedRecord = createSelectedRecordDetail(runtime, input.selectedRecordId);

  return {
    product: "LoginTo tablet shell",
    stage: "M1 core usable, tablet UI shell preview",
    deviceContainer: deviceContainer.createDeviceContainerProfile("tablet"),
    runtime: runtime.snapshot(now()),
    security: runtime.security.snapshot(now()),
    viewState,
    dueNotifications,
    notificationState,
    reminderCenter: createTabletReminderCenter(viewState, dueNotifications, notificationState),
    reviewQueue,
    syncPanel,
    selectedRecord,
    storage: {
      vaultPath: getTabletVaultPath(),
      runtimeStatePath: getTabletRuntimeStatePath(),
      backupPackagePath: getTabletBackupPackagePath(),
      persistedVault: Boolean(runtime.vaultStorage),
      persistedRuntimeState: Boolean(runtime.runtimeStateStorage),
      backup: {
        format: vault.VAULT_PACKAGE_FORMAT,
        targetPath: getTabletBackupPackagePath()
      }
    },
    capabilities: [
      "large-screen local vault review",
      "attachment and OCR draft triage",
      "due reminder management",
      "trusted-device sync overview",
      "local-only terminal workflow"
    ]
  };
}

async function hydrateTabletNotesPreview(runtime, viewState) {
  const records = runtime.repository.listRecords();
  const byId = new Map(records.map((record) => [record.id, record]));
  const tiles = [
    ...(viewState.records ?? []),
    ...(viewState.favorites ?? []),
    ...(viewState.recent ?? [])
  ];
  for (const tile of tiles) {
    const record = byId.get(tile.id);
    const field = record?.fields.find((item) => item.key === "notes");
    if (!record || !field) {
      continue;
    }
    try {
      tile.notesPreview = await runtime.revealFieldValue({
        recordId: record.id,
        fieldKey: field.key,
        sensitivity: field.sensitivity,
        valueCipher: field.valueCipher
      });
    } catch {
      // Existing development-preview records can keep their legacy preview.
    }
  }
}

export function resetTabletShellRuntimeForTests() {
  tabletShellRuntimePromise = undefined;
}

export async function exportTabletShellBackupPackage(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const backupPackage = await runtime.exportEncryptedBackupPackage();
  const packageJson = runtime.serializeEncryptedBackupPackage(backupPackage);
  const savedPath = input.backupPackagePath ?? getTabletBackupPackagePath();
  await writeTextFileAtomically(savedPath, packageJson, (text) => vault.parseVaultPackage(text));

  return {
    ok: true,
    savedPath,
    packageJson,
    summary: createBackupPackageSummary(backupPackage, packageJson, runtime.repository.listRecords().length),
    appState: await createTabletShellAppState()
  };
}

export async function verifyTabletShellBackupPackage(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const backupPackagePath = input.backupPackagePath ?? getTabletBackupPackagePath();
  const packageJson = input.packageJson ?? await readFile(backupPackagePath, "utf8");
  const snapshot = await runtime.verifyEncryptedBackupPackage(packageJson);
  return {
    ok: true,
    verifiedAt: now(),
    summary: {
      records: snapshot.records.length,
      attachments: snapshot.records.reduce((count, record) => count + record.attachments.length, 0),
      vaultId: snapshot.manifest.id,
      backupPackagePath
    }
  };
}

export async function applyTabletShellReminderAction(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const dueNotifications = await runtime.collectDueReminderNotifications(now());
  const snapshot = runtime.reminderNotifications.snapshot(now());
  const alertId = input.alertId
    ?? dueNotifications[0]?.alertId
    ?? snapshot.deliveries[0]?.alertId;

  if (!alertId) {
    throw new Error("No tablet reminder notification is available to update");
  }

  const action = input.action ?? "complete";
  let delivery;
  if (action === "complete" || action === "done") {
    delivery = await runtime.completeReminderNotification(alertId, input.at ?? now());
  } else if (action === "snooze") {
    delivery = await runtime.snoozeReminderNotification(
      alertId,
      input.snoozedUntil ?? "2026-06-25T10:00:00.000Z",
      input.at ?? now()
    );
  } else if (action === "dismiss") {
    delivery = await runtime.dismissReminderNotification(alertId, input.at ?? now());
  } else if (action === "delivered") {
    delivery = await runtime.markReminderNotificationDelivered(alertId, input.at ?? now());
  } else {
    throw new Error(`Unsupported tablet reminder action: ${action}`);
  }

  return {
    ok: true,
    action,
    delivery,
    appState: await createTabletShellAppState()
  };
}

export async function applyTabletShellReviewAction(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const title = input.title?.trim() || "Tablet Reviewed Membership";
  const attachment = input.attachment ?? {
    id: "attachment_tablet_review_queue_photo",
    encryptedBlobPath: "attachments/tablet-review-queue-photo.blob",
    mimeType: "image/jpeg",
    digest: "sha256-tablet-review-queue-photo",
    encryptedSize: 3072,
    source: "camera"
  };
  const attachmentNote = `自动整理：原图 ${attachment.id} 已作为加密附件保存，来源 ${attachment.source ?? "camera"}。`;
  const record = await runtime.createRecord({
    draft: vault.createRecordDraft({
      type: "membership",
      title,
      values: {
        member_name: title,
        member_id: `TABLET-${runtime.repository.listRecords().length + 1}`,
        expires_at: "2027-02-01T00:00:00.000Z",
        service_phone: "400-888-0101",
        notes: attachmentNote
      },
      reminderDrafts: [
        {
          dueAt: "2027-02-01T09:00:00.000Z",
          message: `${title} expires soon`,
          daysBefore: 7
        }
      ]
    })
  });
  runtime.repository.addAttachment(record.id, vault.createAttachmentRef({
    id: attachment.id,
    recordId: record.id,
    encryptedBlobPath: attachment.encryptedBlobPath ?? `attachments/${record.id}.blob`,
    mimeType: attachment.mimeType ?? "image/jpeg",
    digest: attachment.digest ?? `sha256-${record.id}`,
    encryptedSize: attachment.encryptedSize ?? 2048,
    source: attachment.source ?? "import",
    now,
    ids
  }));
  const reviewedRecord = runtime.repository.getRecord(record.id);
  await runtime.saveVaultState();

  return {
    ok: true,
    reviewedRecord: {
      id: reviewedRecord.id,
      title: reviewedRecord.title,
      reminders: reviewedRecord.reminders.length,
      attachments: reviewedRecord.attachments.length,
      attachmentIds: reviewedRecord.attachments.map((item) => item.id),
      attachmentNote
    },
    appState: await createTabletShellAppState()
  };
}

export async function updateTabletShellReviewNotes(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const record = findTabletRecord(runtime, input.recordId);
  const notes = String(input.notes ?? "").trim();
  if (!notes) {
    throw new Error("Review notes cannot be empty");
  }
  await runtime.updateRecordFields(record.id, [
    {
      key: "notes",
      value: notes
    }
  ]);
  return {
    ok: true,
    updatedRecord: {
      id: record.id,
      title: record.title
    },
    appState: await createTabletShellAppState()
  };
}

export async function createTabletShellRecord(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const type = input.type ?? "account";
  const title = input.title?.trim() || "平板本地记录";
  const record = await runtime.createRecord({
    draft: vault.createRecordDraft({
      type,
      title,
      values: createTabletRecordValues(type, {
        ...input,
        ...input.values,
        title,
        notes: input.notes
      }),
      reminderDrafts: createTabletReminderDrafts(input, title)
    })
  });
  if (input.attachment) {
    runtime.repository.addAttachment(record.id, vault.createAttachmentRef({
      id: input.attachment.id,
      recordId: record.id,
      encryptedBlobPath: input.attachment.encryptedBlobPath ?? `attachments/${record.id}.blob`,
      mimeType: input.attachment.mimeType ?? "image/jpeg",
      digest: input.attachment.digest ?? `sha256-${record.id}`,
      encryptedSize: input.attachment.encryptedSize ?? 2048,
      source: input.attachment.source ?? "import",
      now,
      ids
    }));
  }
  await runtime.saveVaultState();
  return {
    ok: true,
    record: {
      id: record.id,
      title: record.title,
      type: record.type
    },
    appState: await createTabletShellAppState({
      selectedRecordId: record.id
    })
  };
}

export async function updateTabletShellRecord(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const record = findTabletRecord(runtime, input.recordId);
  if (input.title?.trim()) {
    runtime.repository.updateRecordMetadata(record.id, { title: input.title.trim() });
  }
  if (input.notes !== undefined) {
    await runtime.updateRecordFields(record.id, [
      {
        key: "notes",
        value: String(input.notes ?? "")
      }
    ]);
  }
  await runtime.saveVaultState();
  return {
    ok: true,
    record: {
      id: record.id,
      title: input.title?.trim() || record.title,
      type: record.type
    },
    appState: await createTabletShellAppState()
  };
}

export async function deleteTabletShellRecord(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const record = findTabletRecord(runtime, input.recordId);
  runtime.repository.deleteRecord(record.id);
  await runtime.saveVaultState();
  return {
    ok: true,
    deletedRecordId: record.id,
    appState: await createTabletShellAppState()
  };
}

export async function removeTabletShellAttachment(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const record = findTabletRecord(runtime, input.recordId);
  const attachmentId = String(input.attachmentId ?? "").trim();
  if (!attachmentId) {
    throw new Error("Tablet attachment id is required");
  }
  const updatedRecord = runtime.repository.removeAttachment(record.id, attachmentId);
  await runtime.saveVaultState();
  return {
    ok: true,
    record: {
      id: updatedRecord.id,
      title: updatedRecord.title,
      attachments: updatedRecord.attachments.length
    },
    removedAttachmentId: attachmentId,
    appState: await createTabletShellAppState({
      selectedRecordId: updatedRecord.id
    })
  };
}

export async function trustTabletShellDesktop(input = {}) {
  const runtime = await getTabletShellRuntime();
  if (!input.payloadText) {
    throw new Error("Tablet desktop trust requires a pairing QR payload");
  }
  const scanned = scanTabletDesktopPairingPayload(input);
  const trustedDevice = runtime.syncSession.trustDevice({
    id: scanned.device.id,
    name: scanned.device.name,
    kind: "desktop",
    publicKeyBase64: scanned.device.publicKeyBase64
  }, input.trustedAt ?? now());
  await runtime.saveRuntimeState(input.trustedAt ?? now());
  return {
    ok: true,
    trustedDevice,
    trustedDevices: runtime.syncSession.trustedDevices.list().length,
    pairing: {
      endpoint: scanned.localEndpoint,
      expiresAt: scanned.expiresAt,
      verificationCode: scanned.verificationCode
    },
    appState: await createTabletShellAppState()
  };
}

export async function revokeTabletShellTrustedDevice(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const deviceId = input.deviceId?.trim();
  if (!deviceId) {
    throw new Error("Trusted device id is required for revocation");
  }
  const device = runtime.syncSession.trustedDevices.get(deviceId);
  if (!device) {
    throw new Error(`Trusted device does not exist: ${deviceId}`);
  }
  if (input.confirmDeviceName !== device.name) {
    throw new Error("Trusted device revocation requires the confirmed device name");
  }
  const revoked = runtime.syncSession.trustedDevices.revoke(deviceId);
  await runtime.saveRuntimeState(input.revokedAt ?? now());
  await appendTrustedDeviceRevocation({
    id: ids.nextId("trusted_device_revocation"),
    revokedAt: input.revokedAt ?? now(),
    deviceId: device.id,
    deviceName: device.name,
    deviceKind: device.kind,
    publicKeyFingerprint: createDeviceKeyFingerprint(device.publicKeyBase64),
    confirmation: "device-name-confirmed"
  });
  return {
    ok: true,
    revoked,
    revokedDeviceId: deviceId,
    revokedDeviceName: device.name,
    appState: await createTabletShellAppState()
  };
}

export async function createTabletShellNearFieldDiscovery(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  return createTabletShellNearFieldDiscoveryFromRuntime(runtime, input);
}

export async function resolveTabletShellDiscoveryCandidateAction(input = {}) {
  const discovery = input.candidate ? input.discovery : await createTabletShellNearFieldDiscovery(input);
  const candidates = [
    input.candidate,
    ...(input.candidates ?? []),
    ...(input.discovery?.candidates ?? []),
    ...(discovery?.candidates ?? [])
  ].filter(Boolean);
  const candidate = selectNearFieldCandidate(candidates, input);
  if (!candidate) {
    return {
      ok: false,
      action: "scan-required",
      reason: "candidate-not-found",
      discovery,
      message: "未找到该近场设备，请重新扫描"
    };
  }
  if (candidate.requiresRepairing || candidate.trustStatus === "needs-repairing") {
    return {
      ok: true,
      action: "repair-pairing",
      candidate,
      message: "设备密钥已变化，需要面对面重新配对"
    };
  }
  if (candidate.requiresPairing || candidate.trustStatus === "needs-pairing") {
    return {
      ok: true,
      action: "pair",
      candidate,
      message: "首次连接需要面对面配对"
    };
  }
  return {
    ok: true,
    action: "sync-preview",
    candidate,
    nextRequest: {
      desktopBaseUrl: candidate.endpoint,
      desktopDeviceId: candidate.device.id,
      desktopDeviceName: candidate.device.name,
      desktopPublicKeyBase64: candidate.device.publicKeyBase64
    },
    message: `可信设备 ${candidate.device.name} 可进入同步确认`
  };
}

function scanTabletDesktopPairingPayload(input) {
  const payload = sync.decodePairingPayloadText(input.payloadText);
  if (payload.device.kind !== "desktop") {
    throw new Error(`Tablet pairing QR must identify a desktop device, got ${payload.device.kind}`);
  }
  if (!payload.localEndpoint?.trim()) {
    throw new Error("Tablet pairing QR must include a local endpoint");
  }
  requireLocalPeerBaseUrl(payload.localEndpoint, "pairing peer");
  if (sync.isPairingPayloadExpired(payload, input.now ?? now())) {
    throw new Error("Tablet pairing QR is expired");
  }
  const verificationCode = createPreviewVerificationCode(JSON.stringify(payload));
  const carrierVerificationCode = createPreviewVerificationCode(input.payloadText);
  const unsignedVerificationCode = createUnsignedPreviewVerificationCode(JSON.stringify(payload));
  const unsignedCarrierVerificationCode = createUnsignedPreviewVerificationCode(input.payloadText);
  if (!input.confirmedCode) {
    throw new Error("Tablet pairing requires the six-digit verification code");
  }
  if (![verificationCode, carrierVerificationCode, unsignedVerificationCode, unsignedCarrierVerificationCode].includes(input.confirmedCode)) {
    throw new Error("Tablet pairing verification code does not match");
  }
  return {
    device: payload.device,
    localEndpoint: payload.localEndpoint,
    expiresAt: payload.expiresAt,
    verificationCode: input.confirmedCode
  };
}

function createPreviewVerificationCode(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String(Math.abs(hash) % 1_000_000).padStart(6, "0");
}

function createUnsignedPreviewVerificationCode(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String((hash >>> 0) % 1_000_000).padStart(6, "0");
}

export async function createTabletShellSyncPreview(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const desktopBaseUrl = requireLocalPeerBaseUrl(input.desktopBaseUrl ?? process.env.LOGINTO_DESKTOP_SYNC_BASE_URL ?? "http://127.0.0.1:4173", "desktop sync target");
  const discoveredDesktop = await discoverDesktopDevice(desktopBaseUrl);
  const desktopDevice = {
    id: input.desktopDeviceId ?? discoveredDesktop?.id ?? "device_desktop_shell",
    name: input.desktopDeviceName ?? discoveredDesktop?.name ?? "LoginTo Desktop Shell",
    kind: "desktop",
    publicKeyBase64: requireDiscoveredPublicKey(input.desktopPublicKeyBase64 ?? discoveredDesktop?.publicKeyBase64, "desktop")
  };
  requireTrustedSyncPeer(runtime, desktopDevice);
  appendTabletRecordSyncChanges(runtime, input.requestedAt ?? now());
  await runtime.saveRuntimeState(input.requestedAt ?? now());
  const localSummary = runtime.syncSession.getLocalSummary();
  const localRecords = summarizeTabletRecords(runtime);
  const remote = await fetchRemoteSyncSummary(desktopBaseUrl);
  const confirmation = createSyncConfirmation({
    direction: "tablet-to-desktop",
    localDevice: runtime.localDevice,
    peerDevice: desktopDevice,
    peerBaseUrl: desktopBaseUrl,
    requestedAt: input.requestedAt ?? now(),
    localSummary,
    remoteSummary: remote?.summary,
    localRecords,
    remoteRecords: remote?.records,
    transport: "local-network"
  });
  const confirmations = await loadSyncConfirmations();
  confirmations.push(confirmation);
  await saveSyncConfirmations(confirmations.slice(-20));
  const requestDelivery = await sendSyncRequestToPeer(desktopBaseUrl, {
    senderDevice: runtime.localDevice,
    senderBaseUrl: input.senderBaseUrl ?? process.env.LOGINTO_TABLET_SYNC_BASE_URL ?? "http://127.0.0.1:4178",
    confirmation
  });
  if (!requestDelivery.ok) {
    await markSyncConfirmationFailed(confirmation.id, requestDelivery.deliveredAt);
    await saveFailedTabletSyncRequestReceipt({ runtime, desktopDevice, desktopBaseUrl, confirmation, requestDelivery });
  }
  return {
    ok: true,
    confirmation,
    requestDelivery,
    appState: await createTabletShellAppState()
  };
}

export async function receiveTabletShellSyncRequest(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const senderDevice = input.senderDevice ?? input.confirmation?.localDevice;
  if (!senderDevice) {
    throw new Error("Sync request sender device is required");
  }
  requireTrustedSyncPeer(runtime, senderDevice);
  const peerBaseUrl = requireLocalPeerBaseUrl(input.senderBaseUrl ?? input.confirmation?.senderBaseUrl ?? input.confirmation?.peerBaseUrl, "sync request sender");
  const inbound = createInboundSyncRequestConfirmation({
    confirmation: input.confirmation,
    localDevice: runtime.localDevice,
    peerDevice: senderDevice,
    peerBaseUrl,
    receivedAt: input.receivedAt ?? now()
  });
  const confirmations = await loadSyncConfirmations();
  const withoutDuplicate = confirmations.filter((item) => item.id !== inbound.id);
  withoutDuplicate.push(inbound);
  await saveSyncConfirmations(withoutDuplicate.slice(-20));
  return {
    ok: true,
    confirmation: inbound,
    appState: await createTabletShellAppState()
  };
}

export async function pushTabletShellSyncToDesktop(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const desktopBaseUrl = requireLocalPeerBaseUrl(input.desktopBaseUrl ?? process.env.LOGINTO_DESKTOP_SYNC_BASE_URL ?? "http://127.0.0.1:4173", "desktop sync target");
  const discoveredDesktop = await discoverDesktopDevice(desktopBaseUrl);
  const desktopDevice = {
    id: input.desktopDeviceId ?? discoveredDesktop?.id ?? "device_desktop_shell",
    name: input.desktopDeviceName ?? discoveredDesktop?.name ?? "LoginTo Desktop Shell",
    kind: "desktop",
    publicKeyBase64: requireDiscoveredPublicKey(input.desktopPublicKeyBase64 ?? discoveredDesktop?.publicKeyBase64, "desktop")
  };
  const confirmation = await requireSyncConfirmation({
    confirmationId: input.confirmationId,
    expectedPeerDeviceId: desktopDevice.id,
    now: input.syncedAt ?? now()
  });
  requireTrustedSyncPeer(runtime, desktopDevice);
  await assertSyncConfirmationStillCurrent({
    confirmation,
    localRecords: summarizeTabletRecords(runtime),
    remoteRecords: (await fetchRemoteSyncSummary(desktopBaseUrl))?.records ?? []
  });
  appendTabletRecordSyncChanges(runtime, input.syncedAt ?? now());
  const exchangePackage = runtime.syncSession.createOutgoingExchangePackage({
    receiverDeviceId: desktopDevice.id,
    sessionId: confirmation.sessionId,
    confirmationId: confirmation.id,
    now: () => input.syncedAt ?? now(),
    ids
  });
  const encryptedPackage = await encryptShellSyncExchangePackage(exchangePackage, runtime.localDevice, desktopDevice);
  let desktopResult;
  try {
    const response = await fetch(`${desktopBaseUrl}/api/sync/receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        senderDevice: runtime.localDevice,
        encryptedPackage,
        transport: "local-network",
        receivedAt: input.syncedAt ?? now(),
        decisions: input.decisions ?? []
      })
    });
    if (!response.ok) {
      throw await createSyncReceiveFailureError(response, "Desktop sync receive failed");
    }
    desktopResult = await response.json();
  } catch (error) {
    await saveFailedTabletOutgoingSyncReceipt({
      runtime,
      desktopDevice,
      desktopBaseUrl,
      exchangePackage,
      error,
      syncedAt: input.syncedAt ?? now()
    });
    await markSyncConfirmationFailed(confirmation.id, input.syncedAt ?? now());
    throw error;
  }
  await runtime.saveRuntimeState(input.syncedAt ?? now());
  await markSyncConfirmationConfirmed(confirmation.id, input.syncedAt ?? now());
  const outgoingReceipt = {
    id: ids.nextId("tablet_sync_receipt"),
    direction: "outgoing",
    status: "success",
    syncedAt: input.syncedAt ?? now(),
    peerDeviceId: desktopDevice.id,
    peerName: desktopDevice.name,
    senderDeviceId: runtime.localDevice.id,
    senderName: runtime.localDevice.name,
    receiverDeviceId: desktopDevice.id,
    packageId: exchangePackage.packageId,
    sentCount: exchangePackage.changes.length,
    receivedCount: desktopResult.receipt?.sentCount ?? 0,
    conflictCount: desktopResult.receipt?.conflictCount ?? desktopResult.receipt?.conflicts ?? 0,
    changes: exchangePackage.changes.length,
    appliedChanges: desktopResult.receipt?.appliedChanges ?? 0,
    resolvedConflicts: desktopResult.receipt?.resolvedConflicts ?? 0,
    conflicts: desktopResult.receipt?.conflicts ?? 0,
    conflictResolutionSummary: desktopResult.receipt?.conflictResolutionSummary ?? [],
    transport: desktopResult.receipt?.transport ?? "local-network"
  };
  const receipts = await loadSyncReceipts();
  receipts.push(outgoingReceipt);
  await saveSyncReceipts(receipts.slice(-20));
  return {
    ok: true,
    desktopBaseUrl,
    packageId: exchangePackage.packageId,
    transportPackage: {
      protocol: encryptedPackage.protocol,
      encrypted: true,
      plaintextExchangeIncluded: false,
      ciphertextBytes: Buffer.from(encryptedPackage.cipher.ciphertextBase64, "base64").length
    },
    sentChanges: exchangePackage.changes.length,
    desktopReceipt: desktopResult.receipt,
    tabletReceipt: outgoingReceipt,
    outgoingReceipt,
    appState: await createTabletShellAppState()
  };
}

export async function simulateTabletShellSyncFailure(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const failure = normalizeDemoSyncFailure(input.reason);
  const peer = {
    id: input.peerDeviceId ?? input.desktopDeviceId ?? "device_desktop_shell",
    name: input.peerDeviceName ?? input.desktopDeviceName ?? "LoginTo Desktop Shell",
    kind: "desktop",
    baseUrl: input.desktopBaseUrl ?? "http://127.0.0.1:4173"
  };
  const receipt = createDemoSyncFailureReceipt({
    id: ids.nextId("tablet_sync_receipt"),
    syncedAt: input.syncedAt ?? now(),
    localDevice: runtime.localDevice,
    peer,
    targetKind: "desktop",
    targetBaseUrl: peer.baseUrl,
    failure
  });
  const receipts = await loadSyncReceipts();
  receipts.push(receipt);
  await saveSyncReceipts(receipts.slice(-20));
  return {
    ok: true,
    reason: failure.reason,
    receipt,
    appState: await createTabletShellAppState()
  };
}

export async function actOnTabletShellSyncConfirmation(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const action = input.action === "confirm" ? "confirm" : input.action === "timeout" ? "timeout" : "reject";
  const failure = normalizeDemoSyncFailure(action === "timeout" ? "timeout" : "peer-rejected");
  const confirmations = await loadSyncConfirmations();
  const confirmation = selectPendingSyncConfirmation(confirmations, input.confirmationId);
  const actedAt = input.actedAt ?? now();
  const updated = confirmations.map((item) => item.id === confirmation.id
    ? action === "confirm" ? {
        ...item,
        status: "confirmed",
        confirmedAt: actedAt
      } : {
        ...item,
        status: action === "timeout" ? "timed-out" : "rejected",
        failedAt: actedAt,
        failureReason: failure.reason,
        failureTitle: failure.title
      }
    : item);
  await saveSyncConfirmations(updated);
  const resultDelivery = confirmation.requestRole === "receiver"
    ? await sendSyncRequestResultToPeer(confirmation.peerBaseUrl, {
        sourceConfirmationId: confirmation.sourceConfirmationId,
        action,
        senderDevice: runtime.localDevice,
        decisions: input.decisions ?? [],
        actedAt
      })
    : undefined;
  if (action === "confirm") {
    return {
      ok: true,
      action,
      confirmationId: confirmation.id,
      resultDelivery,
      appState: await createTabletShellAppState()
    };
  }
  const peer = confirmation.peerDevice ?? {
    id: input.desktopDeviceId ?? "device_desktop_shell",
    name: input.desktopDeviceName ?? "LoginTo Desktop Shell",
    kind: "desktop"
  };
  const receipt = createDemoSyncFailureReceipt({
    id: ids.nextId("tablet_sync_receipt"),
    syncedAt: actedAt,
    localDevice: runtime.localDevice,
    peer,
    targetKind: "desktop",
    targetBaseUrl: confirmation.peerBaseUrl ?? input.desktopBaseUrl ?? "http://127.0.0.1:4173",
    failure
  });
  const receipts = await loadSyncReceipts();
  receipts.push(receipt);
  await saveSyncReceipts(receipts.slice(-20));
  return {
    ok: true,
    action,
    confirmationId: confirmation.id,
    reason: failure.reason,
    receipt,
    resultDelivery,
    appState: await createTabletShellAppState()
  };
}

export async function receiveTabletShellSyncRequestResult(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const action = input.action === "confirm" ? "confirm" : input.action === "timeout" ? "timeout" : "reject";
  const actedAt = input.actedAt ?? now();
  const confirmations = await loadSyncConfirmations();
  const confirmation = confirmations.find((item) => item.id === input.sourceConfirmationId);
  if (!confirmation) {
    throw new Error(`Sync request result target does not exist: ${input.sourceConfirmationId}`);
  }
  assertSyncRequestResultSender(confirmation, input.senderDevice);
  const failure = normalizeDemoSyncFailure(action === "timeout" ? "timeout" : "peer-rejected");
  if (action === "confirm") {
    const peer = confirmation.peerDevice ?? input.senderDevice ?? {
      id: input.desktopDeviceId ?? "device_desktop_shell",
      name: input.desktopDeviceName ?? "LoginTo Desktop Shell",
      kind: "desktop"
    };
    const autoSync = await pushTabletShellSyncToDesktop({
      ...input,
      confirmationId: confirmation.id,
      desktopBaseUrl: confirmation.peerBaseUrl ?? input.desktopBaseUrl,
      desktopDeviceId: peer.id,
      desktopDeviceName: peer.name,
      desktopPublicKeyBase64: peer.publicKeyBase64,
      syncedAt: actedAt
    });
    return {
      ok: true,
      action,
      confirmationId: confirmation.id,
      autoSync,
      appState: autoSync.appState
    };
  }
  const updated = confirmations.map((item) => item.id === confirmation.id
    ? { ...item, status: action === "timeout" ? "timed-out" : "rejected", failedAt: actedAt, failureReason: failure.reason, failureTitle: failure.title }
    : item);
  await saveSyncConfirmations(updated);
  let receipt;
  if (action !== "confirm") {
    const peer = confirmation.peerDevice ?? input.senderDevice ?? {
      id: input.desktopDeviceId ?? "device_desktop_shell",
      name: input.desktopDeviceName ?? "LoginTo Desktop Shell",
      kind: "desktop"
    };
    receipt = createDemoSyncFailureReceipt({
      id: ids.nextId("tablet_sync_receipt"),
      syncedAt: actedAt,
      localDevice: runtime.localDevice,
      peer,
      targetKind: peer.kind ?? "desktop",
      targetBaseUrl: confirmation.peerBaseUrl ?? input.desktopBaseUrl ?? "http://127.0.0.1:4173",
      failure
    });
    const receipts = await loadSyncReceipts();
    receipts.push(receipt);
    await saveSyncReceipts(receipts.slice(-20));
  }
  return {
    ok: true,
    action,
    confirmationId: confirmation.id,
    reason: action === "confirm" ? undefined : failure.reason,
    receipt,
    appState: await createTabletShellAppState()
  };
}

async function saveFailedTabletOutgoingSyncReceipt(input) {
  const failedReceipt = {
    id: ids.nextId("tablet_sync_receipt"),
    direction: "outgoing",
    status: "failure",
    syncedAt: input.syncedAt,
    peerDeviceId: input.desktopDevice.id,
    peerName: input.desktopDevice.name,
    senderDeviceId: input.runtime.localDevice.id,
    senderName: input.runtime.localDevice.name,
    receiverDeviceId: input.desktopDevice.id,
    targetKind: "desktop",
    targetBaseUrl: input.desktopBaseUrl,
    packageId: input.exchangePackage.packageId,
    sentCount: input.exchangePackage.changes.length,
    receivedCount: 0,
    conflictCount: 0,
    changes: input.exchangePackage.changes.length,
    appliedChanges: 0,
    resolvedConflicts: 0,
    conflicts: 0,
    transport: "local-network",
    error: input.error?.message ?? String(input.error),
    errorDetail: input.error?.syncFailureDetail?.detail ?? input.error?.message ?? String(input.error)
  };
  const receipts = await loadSyncReceipts();
  receipts.push(failedReceipt);
  await saveSyncReceipts(receipts.slice(-20));
}

async function saveFailedTabletSyncRequestReceipt(input) {
  const failedReceipt = {
    id: ids.nextId("tablet_sync_receipt"),
    direction: "outgoing",
    status: "failure",
    syncedAt: input.requestDelivery.deliveredAt,
    peerDeviceId: input.desktopDevice.id,
    peerName: input.desktopDevice.name,
    senderDeviceId: input.runtime.localDevice.id,
    senderName: input.runtime.localDevice.name,
    receiverDeviceId: input.desktopDevice.id,
    targetKind: "desktop",
    targetBaseUrl: input.desktopBaseUrl,
    packageId: input.confirmation.id,
    sentCount: 0,
    receivedCount: 0,
    conflictCount: 0,
    changes: 0,
    appliedChanges: 0,
    resolvedConflicts: 0,
    conflicts: 0,
    transport: "local-network",
    error: input.requestDelivery.error ?? `request delivery failed ${input.requestDelivery.status ?? ""}`.trim(),
    errorDetail: "同步请求未送达对方设备，请确认两端可通讯后重新扫描。"
  };
  const receipts = await loadSyncReceipts();
  receipts.push(failedReceipt);
  await saveSyncReceipts(receipts.slice(-20));
}

function assertSyncRequestResultSender(confirmation, senderDevice) {
  const expectedId = confirmation.peerDevice?.id;
  if (!expectedId || senderDevice?.id !== expectedId) {
    throw new Error("Sync request result sender does not match the pending peer");
  }
}

async function createSyncReceiveFailureError(response, prefix) {
  const text = await response.text();
  const detail = summarizeSyncFailureBody(text);
  const error = new Error(`${prefix}: ${response.status}${detail ? ` · ${detail}` : ""}`);
  error.syncFailureDetail = {
    httpStatus: response.status,
    detail,
    responseBody: text.slice(0, 500)
  };
  return error;
}

function summarizeSyncFailureBody(text = "") {
  const trimmed = String(text).trim();
  if (!trimmed) {
    return "empty response";
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.error === "string") {
      return parsed.error;
    }
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
    if (typeof parsed.code === "string") {
      return parsed.code;
    }
    return JSON.stringify(parsed).slice(0, 160);
  } catch {
    return `non-JSON response: ${trimmed.slice(0, 120)}`;
  }
}

export async function receiveTabletShellSyncPackage(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  const senderDevice = input.senderDevice ?? {
    id: input.encryptedPackage?.senderDeviceId,
    name: "Unknown Sync Sender",
    kind: "desktop",
    publicKeyBase64: "unknown-sync-sender-key"
  };
  if (!input.encryptedPackage) {
    throw new Error("Encrypted sync exchange package is required");
  }
  requireTrustedSyncPeer(runtime, senderDevice);
  const exchangePackage = await decryptShellSyncExchangePackage(input.encryptedPackage, runtime.localDevice, senderDevice);
  if (!exchangePackage) {
    throw new Error("Encrypted sync exchange package is required");
  }
  appendTabletRecordSyncChanges(runtime, input.receivedAt ?? now());
  const report = runtime.syncSession.receiveExchangePackage({
    exchangePackage,
    transport: input.transport ?? "local-network",
    decisions: input.decisions,
    now: () => input.receivedAt ?? now(),
    ids
  });
  applyRecordSyncPayloadsToTabletVault(runtime, exchangePackage, report, input.decisions ?? []);
  await runtime.saveVaultState();
  await runtime.saveRuntimeState(input.receivedAt ?? now());
  const receipt = {
    id: ids.nextId("tablet_sync_receipt"),
    direction: "incoming",
    status: "success",
    syncedAt: input.receivedAt ?? now(),
    receivedAt: input.receivedAt ?? now(),
    peerDeviceId: exchangePackage.senderDeviceId,
    peerName: senderDevice.name,
    senderDeviceId: exchangePackage.senderDeviceId,
    senderName: senderDevice.name,
    receiverDeviceId: runtime.localDevice.id,
    packageId: exchangePackage.packageId,
    sentCount: 0,
    receivedCount: exchangePackage.changes.length,
    conflictCount: report.pendingConflicts.length,
    changes: exchangePackage.changes.length,
    appliedChanges: report.appliedChanges.length,
    resolvedConflicts: report.resolvedConflicts.length,
    conflicts: report.pendingConflicts.length,
    conflictResolutionSummary: createConflictResolutionSummary(report, input.decisions ?? [], exchangePackage.changes),
    transport: report.result.transport
  };
  const receipts = await loadSyncReceipts();
  receipts.push(receipt);
  await saveSyncReceipts(receipts.slice(-20));
  return {
    ok: true,
    receipt,
    report,
    appState: await createTabletShellAppState()
  };
}

export async function getTabletShellSyncSummary(input = {}) {
  const runtime = await getTabletShellRuntime();
  await seedRuntime(runtime);
  appendTabletRecordSyncChanges(runtime, input.requestedAt ?? now());
  await runtime.saveRuntimeState(input.requestedAt ?? now());
  return {
    ok: true,
    device: runtime.localDevice,
    requestedAt: input.requestedAt ?? now(),
    summary: runtime.syncSession.getLocalSummary(),
    records: summarizeTabletRecords(runtime)
  };
}

export function createTabletStatusPayload() {
  return {
    product: "LoginTo tablet shell",
    stage: "M1 core usable, tablet UI shell preview",
    workspaceRoot,
    publicRoot,
    deviceContainer: deviceContainer.createDeviceContainerProfile("tablet"),
    capabilities: [
      "large-screen vault review",
      "runtime-backed app-state API",
      "local vault and runtime-state persistence",
      "trusted-device sync overview",
      "local-only terminal workflow"
    ]
  };
}

async function getTabletShellRuntime() {
  if (!tabletShellRuntimePromise) {
    tabletShellRuntimePromise = createTabletShellRuntime();
  }
  return tabletShellRuntimePromise;
}

async function createTabletShellRuntime() {
  const localDevice = await loadLocalDeviceIdentity({
    path: getDeviceIdentityPath(),
    name: "LoginTo Tablet Shell",
    kind: "tablet",
    legacyPublicKeyBase64: "tablet-shell-public-key"
  });
  const vaultStorage = new mobileFileStorage.MobileFileVaultStorageAdapter(getTabletVaultPath());
  const runtimeStateStorage = new mobileRuntimeState.MobileFileRuntimeStateStorageAdapter(getTabletRuntimeStatePath());
  return mobileRuntime.createMobileRuntime({
    vaultName: "LoginTo Tablet Shell Vault",
    password,
    saltBase64,
    localDevice,
    vaultStorage,
    runtimeStateStorage,
    kdfIterations: 20_000,
    now,
    ids
  });
}

async function seedRuntime(runtime) {
  let inserted = false;
  const existingTitles = new Set(runtime.repository.listRecords().map((record) => record.title));
  for (const seed of seedRecords) {
    if (existingTitles.has(seed.title)) {
      continue;
    }
    await runtime.createRecord({
      draft: vault.createRecordDraft({
        type: seed.type,
        title: seed.title,
        values: seed.values,
        reminderDrafts: seed.reminderDrafts ?? []
      }),
      favorite: seed.favorite
    });
    inserted = true;
  }
  if (inserted) {
    await runtime.saveVaultState();
  }
}

function createReviewQueue(viewState) {
  const attachmentCandidates = viewState.recent
    .filter((record) => record.type === "identity_document" || record.attachmentCount > 0)
    .slice(0, 4);
  return {
    pendingOcrDrafts: 2,
    attachmentCandidates,
    batchActions: [
      "confirm OCR fields",
      "review encrypted attachments",
      "prepare face-to-face sync"
    ]
  };
}

function createTabletReminderCenter(viewState, dueNotifications, notificationState) {
  const deliveryByAlertId = new Map(notificationState.deliveries.map((delivery) => [delivery.alertId, delivery]));
  const dueAlertIds = new Set(dueNotifications.map((delivery) => delivery.alertId));
  const pending = dueNotifications.map((delivery) => toTabletReminderCenterItem({
    alertId: delivery.alertId,
    recordId: delivery.recordId,
    reminderId: delivery.reminderId,
    recordTitle: delivery.recordTitle,
    title: delivery.title,
    body: delivery.message,
    dueAt: delivery.dueAt,
    triggerAt: delivery.triggerAt,
    status: delivery.status,
    source: "due"
  }, delivery));
  const upcoming = (viewState.upcomingAlerts ?? [])
    .filter((alert) => {
      const alertId = createTabletReminderAlertId(alert);
      return !dueAlertIds.has(alertId);
    })
    .map((alert) => {
      const alertId = createTabletReminderAlertId(alert);
      return toTabletReminderCenterItem({
        alertId,
        recordId: alert.recordId,
        reminderId: alert.id,
        recordTitle: alert.recordTitle,
        title: alert.title,
        body: alert.body,
        dueAt: alert.dueAt,
        triggerAt: alert.triggerAt,
        status: alert.status,
        source: "upcoming"
      }, deliveryByAlertId.get(alertId));
    });
  const history = notificationState.deliveries
    .filter((delivery) => !dueAlertIds.has(delivery.alertId) && ["completed", "snoozed", "dismissed"].includes(delivery.status))
    .slice(-8)
    .map((delivery) => toTabletReminderCenterItem({
      alertId: delivery.alertId,
      recordId: delivery.recordId,
      reminderId: delivery.reminderId,
      recordTitle: delivery.recordTitle,
      title: delivery.title,
      body: delivery.message,
      dueAt: delivery.dueAt,
      triggerAt: delivery.triggerAt,
      status: delivery.status,
      source: "history"
    }, delivery));
  const items = [...pending, ...upcoming, ...history];
  return {
    filters: [
      { id: "all", label: "全部", count: items.length },
      { id: "due", label: "到期", count: pending.length },
      { id: "upcoming", label: "即将", count: upcoming.length },
      { id: "history", label: "已处理", count: history.length }
    ],
    pending,
    upcoming,
    history,
    items
  };
}

function toTabletReminderCenterItem(alert, delivery) {
  const popup = createReminderPopupCopy(alert);
  return {
    alertId: alert.alertId,
    recordId: alert.recordId,
    reminderId: alert.reminderId,
    recordTitle: alert.recordTitle,
    title: alert.title,
    body: alert.body,
    reminderKind: popup.kind,
    popupTitle: popup.title,
    popupBody: popup.body,
    dueAt: alert.dueAt,
    triggerAt: alert.triggerAt,
    status: delivery?.status ?? alert.status,
    source: alert.source,
    snoozedUntil: delivery?.snoozedUntil,
    lastStatusAt: delivery?.lastStatusAt,
    canAct: alert.source === "due" && !["completed", "dismissed"].includes(delivery?.status)
  };
}

function createTabletReminderAlertId(alert) {
  return ["reminder", alert.recordId, alert.id, alert.triggerAt].join(":");
}

function createReminderPopupCopy(alert = {}) {
  const text = `${alert.recordTitle ?? ""} ${alert.title ?? ""} ${alert.body ?? ""}`.toLowerCase();
  const kind = text.includes("card") || text.includes("bank") || text.includes("银行") || text.includes("账单")
    ? "bank_card"
    : text.includes("passport") || text.includes("护照") || text.includes("证件")
      ? "identity_document"
      : text.includes("member") || text.includes("vip") || text.includes("会员")
        ? "membership"
        : "record";
  const title = {
    bank_card: "银行卡提醒",
    identity_document: "证件提醒",
    membership: "会员信息提醒",
    record: "记录提醒"
  }[kind];
  const dueText = alert.dueAt ? `到期/触发时间：${alert.dueAt}` : "到期/触发时间：未设置";
  return {
    kind,
    title,
    body: `${alert.body ?? alert.title ?? "有一条本地提醒需要处理。"} · ${dueText}`
  };
}

function createTabletSyncPanel(runtime, receipts = [], confirmations = [], discovery, revocations = []) {
  const trustedDevices = runtime.syncSession.trustedDevices.list();
  const trustedDeviceSummaries = createTrustedDeviceSummaries(trustedDevices, receipts, discovery);
  const recentReceipts = createRecentSyncReceiptSummaries(receipts);
  const pendingConfirmations = confirmations.filter((item) => item.status === "pending");
  const connectionState = sync.createNearFieldConnectionState({
    discovery,
    pendingConfirmations,
    recentReceipts,
    now: now()
  });
  return {
    localDevice: runtime.localDevice,
    trustedDevices,
    trustedDeviceSummaries,
    trustedDeviceRevocations: revocations.slice(-10).reverse(),
    changeCount: runtime.syncSession.changeLog.list().length,
    recommendedTransport: "local-network",
    lastReceipt: receipts.at(-1),
    lastReceiptSummary: createSyncReceiptSummary(receipts.at(-1)),
    recentReceipts,
    receiptCount: receipts.length,
    pendingConfirmation: pendingConfirmations.at(-1),
    connectionState,
    syncCenter: createSyncCenterSummary({
      trustedDeviceSummaries,
      revocations,
      receipts,
      confirmations,
      discovery,
      connectionState
    }),
    discovery
  };
}

function createSelectedRecordDetail(runtime, recordId) {
  const records = runtime.repository.listRecords();
  const record = recordId
    ? records.find((item) => item.id === recordId) ?? records[0]
    : records[0];
  if (!record) {
    return undefined;
  }
  return toTabletRecordDetail(record);
}

function toTabletRecordDetail(record) {
  const notesField = record.fields.find((field) => field.key === "notes");
  return {
    id: record.id,
    title: record.title,
    type: record.type,
    favorite: record.favorite,
    archived: record.archived,
    updatedAt: record.updatedAt,
    reminderCount: record.reminders.length,
    attachmentCount: record.attachments.length,
    notesPreview: notesField ? "已保存整理备注，字段仍保持本地加密" : "暂无整理备注",
    fields: record.fields.map((field) => ({
      key: field.key,
      label: field.label,
      sensitivity: field.sensitivity,
      valueState: field.valueCipher ? "encrypted" : "empty"
    })),
    reminders: record.reminders.map((reminder) => ({
      id: reminder.id,
      dueAt: reminder.dueAt,
      message: reminder.message,
      daysBefore: reminder.daysBefore
    })),
    attachments: record.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      source: attachment.source,
      encryptedBlobPath: attachment.encryptedBlobPath,
      encryptedSize: attachment.encryptedSize,
      encrypted: true
    }))
  };
}

function findTabletRecord(runtime, recordId) {
  const records = runtime.repository.listRecords();
  const record = records.find((item) => item.id === recordId) ?? records[0];
  if (!record) {
    throw new Error("Record is not available");
  }
  return record;
}

function createTabletRecordValues(type, input = {}) {
  const notes = input.notes ?? "";
  if (type === "membership") {
    return {
      member_name: input.member_name ?? input.title ?? "",
      member_id: input.member_id ?? input.account ?? "",
      expires_at: normalizeTabletDate(input.expires_at) ?? "2027-01-31T00:00:00.000Z",
      service_phone: input.service_phone ?? "",
      notes
    };
  }
  if (type === "bank_card") {
    return {
      cardholder: input.cardholder ?? input.username ?? "",
      card_number: input.card_number ?? input.account ?? "",
      bank_name: input.bank_name ?? input.title ?? "本地银行卡",
      statement_day: input.statement_day ?? "",
      notes
    };
  }
  if (type === "identity_document") {
    return {
      document_type: input.document_type ?? input.title ?? "证件",
      document_number: input.document_number ?? input.account ?? "",
      expires_at: normalizeTabletDate(input.expires_at) ?? "2028-01-31T00:00:00.000Z",
      issued_by: input.issued_by ?? "",
      notes
    };
  }
  return {
    username: input.username ?? input.account ?? "",
    password: input.password ?? "",
    url: input.url ?? "",
    notes
  };
}

function createTabletReminderDrafts(input, title) {
  if (!input.reminderAt) {
    return [];
  }
  return [
    {
      dueAt: normalizeTabletDate(input.reminderAt) ?? input.reminderAt,
      message: input.reminderMessage?.trim() || `${title} 提醒`,
      daysBefore: Number.isFinite(Number(input.daysBefore)) ? Number(input.daysBefore) : 0
    }
  ];
}

function normalizeTabletDate(value) {
  if (!value) {
    return undefined;
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text}T09:00:00.000Z`;
  }
  return text;
}

function requireTrustedSyncPeer(runtime, peerDevice) {
  const trustedDevice = runtime.syncSession.trustedDevices.list().find((device) => device.id === peerDevice.id);
  if (!trustedDevice) {
    throw new Error(`Sync peer is not trusted. Pair face-to-face first: ${peerDevice.id}`);
  }
  if (trustedDevice.publicKeyBase64 !== peerDevice.publicKeyBase64) {
    throw new Error(`Sync peer public key does not match trusted device: ${peerDevice.id}`);
  }
  return trustedDevice;
}

function getTabletVaultPath() {
  return process.env.LOGINTO_TABLET_SHELL_VAULT_PATH || defaultVaultPath;
}

function getTabletRuntimeStatePath() {
  return process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH
    || mobileRuntimeState.createDefaultMobileRuntimeStatePath(getTabletVaultPath());
}

function getTabletBackupPackagePath() {
  return process.env.LOGINTO_TABLET_BACKUP_PACKAGE_PATH || defaultBackupPackagePath;
}

function getSyncReceiptPath() {
  return process.env.LOGINTO_TABLET_SYNC_RECEIPTS_PATH || defaultSyncReceiptPath;
}

function getSyncConfirmationPath() {
  return process.env.LOGINTO_TABLET_SYNC_CONFIRMATIONS_PATH || defaultSyncConfirmationPath;
}

function getTrustedDeviceRevocationPath() {
  return process.env.LOGINTO_TABLET_TRUSTED_DEVICE_REVOCATIONS_PATH || defaultTrustedDeviceRevocationPath;
}

function getDeviceIdentityPath() {
  return process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH || defaultDeviceIdentityPath;
}

function appendTabletRecordSyncChanges(runtime, at) {
  let lamport = runtime.syncSession.changeLog.list().length;
  for (const record of runtime.repository.listRecords()) {
    lamport += 1;
    runtime.appendLocalSyncChange(sync.createSyncChange({
      entity: "record",
      entityId: record.id,
      operation: record.archived ? "archive" : "update",
      deviceId: runtime.localDevice.id,
      lamport,
      payloadCipher: createRecordSyncPayload(record),
      createdAt: at,
      ids
    }));
  }
}

function createRecordSyncPayload(record) {
  return `record-snapshot-v1:${Buffer.from(JSON.stringify({ record })).toString("base64")}`;
}

function parseRecordSyncPayload(change) {
  if (!change?.payloadCipher?.startsWith("record-snapshot-v1:")) {
    return undefined;
  }
  const encoded = change.payloadCipher.slice("record-snapshot-v1:".length);
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")).record;
}

function parseRecordDeletePayload(change) {
  if (!change?.payloadCipher?.startsWith("record-delete-v1:")) {
    return undefined;
  }
  const encoded = change.payloadCipher.slice("record-delete-v1:".length);
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")).tombstone;
}

function applyRecordSyncPayloadsToTabletVault(runtime, exchangePackage, report, decisions) {
  const changesById = new Map(exchangePackage.changes.map((change) => [change.id, change]));
  for (const change of exchangePackage.changes) {
    if (change.operation === "delete") {
      const deletedRecord = parseRecordDeletePayload(change);
      if (deletedRecord) {
        runtime.repository.deleteRecord(deletedRecord.id);
      }
    }
  }
  for (const change of report.appliedChanges) {
    const deletedRecord = parseRecordDeletePayload(change);
    if (deletedRecord) {
      runtime.repository.deleteRecord(deletedRecord.id);
      continue;
    }
    const record = parseRecordSyncPayload(change);
    if (record) {
      upsertTabletVaultRecord(runtime, record);
    }
  }
  for (const conflict of report.resolvedConflicts) {
    if (conflict.resolution !== "manual-merge") {
      continue;
    }
    const remoteRecord = parseRecordSyncPayload(changesById.get(conflict.remoteChangeId));
    const localRecord = runtime.repository.getRecord(conflict.entityId);
    if (!remoteRecord || !localRecord) {
      continue;
    }
    const decision = findRecordConflictDecision(decisions, conflict);
    runtime.repository.replaceRecord(mergeRecordFieldsByDecision(localRecord, remoteRecord, decision?.manualMerge));
  }
}

function findRecordConflictDecision(decisions, conflict) {
  return decisions.find((item) => {
    return item.conflictId === conflict.id || item.conflictId === `record_conflict_${conflict.entityId}`;
  });
}

function createConflictResolutionSummary(report, decisions = [], changes = []) {
  const seen = new Set();
  const changesById = new Map(changes.map((change) => [change.id, change]));
  return (report.resolvedConflicts ?? []).map((conflict) => {
    const decision = findRecordConflictDecision(decisions, conflict);
    const localRecord = parseRecordSyncPayload(changesById.get(conflict.localChangeId));
    const remoteRecord = parseRecordSyncPayload(changesById.get(conflict.remoteChangeId));
    const recordTitle = remoteRecord?.title ?? localRecord?.title ?? conflict.entityId;
    const fields = (decision?.manualMerge?.fields ?? []).map((field) => ({
      fieldKey: field.fieldKey,
      source: field.source,
      label: `${field.fieldKey}:${field.source === "remote" ? "对方" : "本机"}`
    }));
    const resolution = decision?.resolution ?? conflict.resolution;
    const fieldText = fields.length ? `（${fields.map((field) => field.label).join("、")}）` : "";
    return {
      conflictId: conflict.id,
      recordId: conflict.entityId,
      recordTitle,
      resolution,
      resolutionLabel: conflictResolutionLabel(resolution),
      fields,
      summary: `${recordTitle}：${conflictResolutionLabel(resolution)}${fieldText}`
    };
  }).filter((item) => {
    const key = `${item.recordId}:${item.resolution}:${item.fields.map((field) => `${field.fieldKey}:${field.source}`).join("|")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatConflictResolutionSummaryItem(item) {
  const fields = (item.fields ?? []).map((field) => field.label).filter(Boolean).join("、");
  const fieldText = fields ? `（${fields}）` : "";
  return `${item.recordTitle ?? item.recordId}：${item.resolutionLabel ?? item.resolution}${fieldText}`;
}

function conflictResolutionLabel(resolution) {
  return {
    "use-local": "保留本机",
    "use-remote": "使用对方",
    "keep-both": "保留两份",
    "manual-merge": "手动合并",
    "ignore-remote": "忽略传入"
  }[resolution] ?? resolution;
}

function upsertTabletVaultRecord(runtime, record) {
  if (runtime.repository.getRecord(record.id)) {
    runtime.repository.replaceRecord(record);
  } else {
    runtime.repository.insertRecord(record);
  }
}

function mergeRecordFieldsByDecision(localRecord, remoteRecord, manualMerge) {
  const remoteFields = new Map(remoteRecord.fields.map((field) => [field.key, field]));
  const choices = new Map((manualMerge?.fields ?? []).map((field) => [field.fieldKey, field.source]));
  const localFieldKeys = new Set(localRecord.fields.map((field) => field.key));
  const selectedRemoteOnlyFields = remoteRecord.fields.filter((field) => {
    return !localFieldKeys.has(field.key) && choices.get(field.key) === "remote";
  });
  return {
    ...localRecord,
    title: choices.get("title") === "remote" ? remoteRecord.title : localRecord.title,
    fields: [
      ...localRecord.fields.map((field) => {
        return choices.get(field.key) === "remote" && remoteFields.has(field.key)
          ? remoteFields.get(field.key)
          : field;
      }),
      ...selectedRemoteOnlyFields
    ],
    version: localRecord.version + 1,
    updatedAt: new Date(Math.max(Date.parse(localRecord.updatedAt), Date.parse(remoteRecord.updatedAt))).toISOString()
  };
}

function summarizeTabletRecords(runtime) {
  return runtime.repository.listRecords().map((record) => ({
    id: record.id,
    title: record.title,
    type: record.type,
    version: record.version,
    updatedAt: record.updatedAt,
    archived: record.archived,
    fieldCount: record.fields.length,
    sensitiveFieldCount: record.fields.filter((field) => field.sensitivity === "secret" || field.sensitivity === "critical").length,
    fieldKeys: record.fields.map((field) => ({
      key: field.key,
      sensitivity: field.sensitivity,
      updatedAt: field.updatedAt
    }))
  }));
}

function createSyncConfirmation(input) {
  const recordPreview = createRecordSyncPreview(input.localRecords ?? [], input.remoteRecords ?? []);
  const review = createSyncConfirmationReview(input, recordPreview);
  return {
    id: ids.nextId("sync_confirmation"),
    sessionId: ids.nextId("sync_session"),
    status: "pending",
    direction: input.direction,
    requestedAt: input.requestedAt,
    expiresAt: addSeconds(input.requestedAt, 300),
    transport: input.transport,
    localDevice: input.localDevice,
    peerDevice: input.peerDevice,
    peerBaseUrl: input.peerBaseUrl,
    localSummary: input.localSummary,
    remoteSummary: input.remoteSummary,
    localRecords: input.localRecords ?? [],
    remoteRecords: input.remoteRecords ?? [],
    preview: {
      sendChanges: recordPreview.recordsToSend.length,
      receiveChanges: recordPreview.recordsToReceive.length,
      conflicts: recordPreview.conflicts.length,
      categories: ["account", "membership", "bank_card", "identity_document"]
    },
    review,
    recordsToSend: recordPreview.recordsToSend,
    recordsToReceive: recordPreview.recordsToReceive,
    conflicts: recordPreview.conflicts
  };
}

function createSyncConfirmationReview(input, recordPreview) {
  const sendChanges = recordPreview.recordsToSend.length;
  const receiveChanges = recordPreview.recordsToReceive.length;
  const conflicts = recordPreview.conflicts.length;
  return {
    peerDeviceId: input.peerDevice.id,
    peerDeviceName: input.peerDevice.name,
    peerBaseUrl: input.peerBaseUrl,
    peerKeyFingerprint: createDeviceKeyFingerprint(input.peerDevice.publicKeyBase64),
    requestedAt: input.requestedAt,
    expiresAt: addSeconds(input.requestedAt, 300),
    transport: input.transport,
    publicNetworkLogin: false,
    requiresRepairing: false,
    pairingAction: "not-required",
    summaryText: `发送 ${sendChanges} · 接收 ${receiveChanges} · 冲突 ${conflicts}`,
    changeSummary: {
      sendChanges,
      receiveChanges,
      conflicts,
      categories: ["account", "membership", "bank_card", "identity_document"]
    },
    recordLines: [
      ...recordPreview.recordsToSend.slice(0, 6).map((item) => `发送：${item.record.title}`),
      ...recordPreview.recordsToReceive.slice(0, 6).map((item) => `接收：${item.record.title}`),
      ...recordPreview.conflicts.slice(0, 6).map((item) => `冲突：${item.title}`)
    ]
  };
}

function createRecordSyncPreview(localRecords, remoteRecords) {
  const remoteById = new Map(remoteRecords.map((record) => [record.id, record]));
  const localById = new Map(localRecords.map((record) => [record.id, record]));
  const recordsToSend = [];
  const recordsToReceive = [];
  const conflicts = [];
  for (const record of localRecords) {
    const remote = remoteById.get(record.id);
    if (!remote) {
      recordsToSend.push({ operation: record.archived ? "archive" : "create", record });
      continue;
    }
    if (record.updatedAt !== remote.updatedAt || record.version !== remote.version) {
      conflicts.push(createRecordConflictPreview(record, remote));
    }
  }
  for (const record of remoteRecords) {
    if (!localById.has(record.id)) {
      recordsToReceive.push({ operation: record.deleted ? "delete" : record.archived ? "archive" : "create", record });
      continue;
    }
    if (record.deleted) {
      recordsToReceive.push({ operation: "delete", record });
    }
  }
  return { recordsToSend, recordsToReceive, conflicts };
}

function assertSyncConfirmationStillCurrent(input) {
  const current = createRecordSyncPreview(input.localRecords, input.remoteRecords);
  if (createSyncPreviewSignature(current) !== createSyncPreviewSignature(input.confirmation)) {
    throw new Error("Sync preview changed after confirmation. Create a fresh preview before syncing.");
  }
}

function createSyncPreviewSignature(preview) {
  return JSON.stringify({
    send: (preview.recordsToSend ?? []).map(createSyncPreviewItemSignature).sort(),
    receive: (preview.recordsToReceive ?? []).map(createSyncPreviewItemSignature).sort(),
    conflicts: (preview.conflicts ?? []).map(createSyncConflictPreviewSignature).sort()
  });
}

function createSyncPreviewItemSignature(item) {
  const record = item.record ?? {};
  return [
    item.operation,
    record.id,
    record.version,
    record.updatedAt,
    record.deleted === true,
    record.archived === true
  ].join("|");
}

function createSyncConflictPreviewSignature(conflict) {
  return [
    conflict.recordId,
    conflict.localUpdatedAt,
    conflict.remoteUpdatedAt,
    ...(conflict.fields ?? []).map((field) => `${field.key}:${field.localUpdatedAt}:${field.remoteUpdatedAt}`).sort()
  ].join("|");
}

function createRecordConflictPreview(localRecord, remoteRecord) {
  const localFields = new Map(localRecord.fieldKeys.map((field) => [field.key, field]));
  const remoteFields = new Map(remoteRecord.fieldKeys.map((field) => [field.key, field]));
  const fields = [];
  if (localRecord.title !== remoteRecord.title) {
    fields.push({
      key: "title",
      side: "both",
      sensitivity: "normal",
      localUpdatedAt: localRecord.updatedAt,
      remoteUpdatedAt: remoteRecord.updatedAt
    });
  }
  for (const [key, local] of localFields) {
    const remote = remoteFields.get(key);
    if (remote && local.updatedAt !== remote.updatedAt) {
      fields.push({
        key,
        side: "both",
        sensitivity: local.sensitivity === "critical" || remote.sensitivity === "critical" ? "critical" : local.sensitivity,
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: remote.updatedAt
      });
    }
    if (!remote) {
      fields.push({
        key,
        side: "local-only",
        sensitivity: local.sensitivity,
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: undefined
      });
    }
  }
  for (const [key, remote] of remoteFields) {
    if (!localFields.has(key)) {
      fields.push({
        key,
        side: "remote-only",
        sensitivity: remote.sensitivity,
        localUpdatedAt: undefined,
        remoteUpdatedAt: remote.updatedAt
      });
    }
  }
  return {
    id: `record_conflict_${localRecord.id}`,
    recordId: localRecord.id,
    title: localRecord.title,
    type: localRecord.type,
    localUpdatedAt: localRecord.updatedAt,
    remoteUpdatedAt: remoteRecord.updatedAt,
    fields,
    resolutionOptions: [
      { value: "use-local", label: "保留本机" },
      { value: "use-remote", label: "使用对方" },
      { value: "keep-both", label: "保留两份/手动合并" },
      { value: "manual-merge", label: "手动合并" },
      { value: "ignore-remote", label: "忽略传入" }
    ]
  };
}

function selectNearFieldCandidate(candidates, input = {}) {
  if (!candidates.length) {
    return undefined;
  }
  if (input.candidateId) {
    return candidates.find((candidate) => candidate.id === input.candidateId);
  }
  if (input.endpoint) {
    return candidates.find((candidate) => candidate.endpoint === input.endpoint);
  }
  if (input.deviceId) {
    return candidates.find((candidate) => candidate.device?.id === input.deviceId);
  }
  return candidates[0];
}

function createSyncReceiptSummary(receipt) {
  if (!receipt) {
    return undefined;
  }
  const sentCount = Number(receipt.sentCount ?? receipt.changes ?? 0);
  const receivedCount = Number(receipt.receivedCount ?? 0);
  const conflictCount = Number(receipt.conflictCount ?? receipt.conflicts ?? 0);
  const resolvedConflicts = Number(receipt.resolvedConflicts ?? 0);
  const conflictResolutionSummary = receipt.conflictResolutionSummary ?? [];
  const conflictResolutionText = conflictResolutionSummary.map(formatConflictResolutionSummaryItem).filter(Boolean).join("；");
  const status = receipt.status ?? "success";
  const failureRecovery = status === "failure" ? createSyncFailureRecovery(receipt.errorDetail ?? receipt.error) : undefined;
  const peerName = receipt.peerName
    ?? (receipt.direction === "incoming" ? receipt.senderName : undefined)
    ?? receipt.receiverName
    ?? receipt.senderName
    ?? "未知设备";
  return {
    id: receipt.id,
    peerDeviceId: receipt.peerDeviceId ?? receipt.senderDeviceId ?? receipt.receiverDeviceId,
    peerName,
    status,
    direction: receipt.direction ?? "unknown",
    syncedAt: receipt.syncedAt ?? receipt.receivedAt,
    transport: receipt.transport ?? "local-network",
    sentCount,
    receivedCount,
    conflictCount,
    resolvedConflicts,
    conflictResolutionSummary,
    conflictResolutionText,
    appliedChanges: Number(receipt.appliedChanges ?? receivedCount),
    error: receipt.error,
    errorDetail: receipt.errorDetail,
    failureReason: failureRecovery?.reason,
    recoveryTitle: failureRecovery?.title,
    recoveryCopy: failureRecovery?.copy,
    recoveryDetail: receipt.errorDetail ?? receipt.error,
    recoveryActions: failureRecovery?.actions,
    retryRequest: status === "failure" && receipt.targetBaseUrl ? {
      desktopBaseUrl: receipt.targetBaseUrl,
      desktopDeviceId: receipt.peerDeviceId ?? receipt.receiverDeviceId,
      desktopDeviceName: peerName
    } : undefined,
    displayLabel: status === "failure" || !conflictResolutionText ? undefined : `合并结果：${conflictResolutionText}`,
    label: status === "failure"
      ? `同步失败：${peerName} · ${failureRecovery?.title ?? receipt.error ?? "未知错误"}`
      : `最近同步：${peerName} · 发送 ${sentCount} 条 · 接收 ${receivedCount} 条 · 冲突 ${conflictCount} 条`
  };
}

function normalizeDemoSyncFailure(reason = "timeout") {
  if (reason === "peer-rejected") {
    return {
      reason: "peer-rejected",
      title: "对方拒绝同步",
      detail: "rejected by peer: user declined sync request after reviewing the local change summary"
    };
  }
  if (reason === "target-offline") {
    return {
      reason: "target-offline",
      title: "目标设备离线",
      detail: "fetch failed ECONNREFUSED while contacting peer on the local network"
    };
  }
  return {
    reason: "timeout",
    title: "连接超时",
    detail: "AbortError: signal timed out while waiting for peer response"
  };
}

function createDemoSyncFailureReceipt(input) {
  return {
    id: input.id,
    direction: "outgoing",
    status: "failure",
    syncedAt: input.syncedAt,
    peerDeviceId: input.peer.id,
    peerName: input.peer.name,
    senderDeviceId: input.localDevice.id,
    senderName: input.localDevice.name,
    receiverDeviceId: input.peer.id,
    targetKind: input.targetKind,
    targetBaseUrl: input.targetBaseUrl,
    packageId: ids.nextId("demo_sync_package"),
    sentCount: 0,
    receivedCount: 0,
    conflictCount: 0,
    changes: 0,
    appliedChanges: 0,
    resolvedConflicts: 0,
    conflicts: 0,
    transport: "local-network",
    failureReason: input.failure.reason,
    recoveryTitle: input.failure.title,
    error: input.failure.title,
    errorDetail: input.failure.detail
  };
}

function selectPendingSyncConfirmation(confirmations = [], confirmationId) {
  const confirmation = confirmationId
    ? confirmations.find((item) => item.id === confirmationId)
    : confirmations.findLast?.((item) => item.status === "pending")
      ?? [...confirmations].reverse().find((item) => item.status === "pending");
  if (!confirmation) {
    throw new Error("No pending sync confirmation is available");
  }
  if (confirmation.status !== "pending") {
    throw new Error(`Sync confirmation is not pending: ${confirmation.status}`);
  }
  return confirmation;
}

function createSyncFailureRecovery(error = "") {
  const message = String(error ?? "");
  const normalized = message.toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("timed out") || message.includes("AbortError")) {
    return {
      reason: "timeout",
      title: "连接超时",
      copy: "等待对方响应超时，请确认对方仍在同步界面，并重新扫描或重试同步。",
      actions: ["rescan", "retry-sync"]
    };
  }
  if (normalized.includes("rejected") || normalized.includes("declined") || normalized.includes("denied") || normalized.includes("refused by peer") || normalized.includes("cancelled by peer")) {
    return {
      reason: "peer-rejected",
      title: "对方拒绝同步",
      copy: "对方设备拒绝了本次同步请求，请当面确认设备名、时间和变更摘要后再重试。",
      actions: ["rescan", "retry-sync", "repair-pairing"]
    };
  }
  if (message.includes("not trusted") || message.includes("Pair face-to-face first")) {
    return {
      reason: "untrusted-peer",
      title: "设备未信任",
      copy: "这台设备不在可信设备列表中，需要面对面扫码并确认 6 位校验码。",
      actions: ["repair-pairing"]
    };
  }
  if (message.includes("public key does not match") || message.includes("key does not match")) {
    return {
      reason: "key-changed",
      title: "设备密钥已变化",
      copy: "发现对方设备密钥和可信列表不一致，请重新面对面配对后再同步。",
      actions: ["repair-pairing", "rescan"]
    };
  }
  if (message.includes("confirmation") || message.includes("expired") || message.includes("not pending")) {
    return {
      reason: "confirmation-stale",
      title: "同步确认已失效",
      copy: "同步摘要已经过期或被使用过，请重新生成摘要并再次确认。",
      actions: ["rescan", "retry-sync"]
    };
  }
  if (message.includes("offline") || message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("receive failed") || message.includes("Target sync receive failed")) {
    return {
      reason: "target-offline",
      title: "目标设备离线",
      copy: "没有连上对方设备，请确认两端在同一局域网或面对面热点中，并重新扫描。",
      actions: ["rescan"]
    };
  }
  return {
    reason: "unknown",
    title: "同步失败",
    copy: message || "未知错误，请重新扫描设备；如果仍失败，再重新配对。",
    actions: ["rescan", "retry-sync", "repair-pairing"]
  };
}

function createRecentSyncReceiptSummaries(receipts = []) {
  return receipts
    .slice(-5)
    .reverse()
    .map((receipt) => createSyncReceiptSummary(receipt))
    .filter(Boolean);
}

function createSyncCenterSummary(input = {}) {
  const trustedDeviceSummaries = input.trustedDeviceSummaries ?? [];
  const recentReceipts = createRecentSyncReceiptSummaries(input.receipts ?? []);
  const pendingConfirmations = (input.confirmations ?? []).filter((item) => item.status === "pending");
  const failures = recentReceipts.filter((receipt) => receipt.status === "failure");
  const revocations = input.revocations ?? [];
  const candidates = input.discovery?.candidates ?? [];
  const recentSuccessCount = recentReceipts.filter((receipt) => receipt.status !== "failure").length;
  const status = failures.length
    ? "needs-attention"
    : pendingConfirmations.length
      ? "pending-review"
      : trustedDeviceSummaries.length
        ? "ready"
        : "pairing-needed";
  const statusCopy = {
    "needs-attention": ["需要处理", "有同步失败或信任异常，先恢复连接再继续同步。", "查看失败恢复"],
    "pending-review": ["等待确认", "同步前需要确认对方设备、时间和变更摘要。", "确认同步摘要"],
    ready: ["可以同步", "可信设备已就绪，靠近后仍会展示变更摘要再执行。", "扫描近场设备"],
    "pairing-needed": ["需要配对", "首次连接必须面对面扫码并核对 6 位校验码。", "面对面配对"]
  }[status];
  const items = [
    ...failures.slice(0, 2).map((receipt) => ({
      kind: "failure",
      title: receipt.recoveryTitle ?? `同步失败：${receipt.peerName}`,
      copy: receipt.recoveryCopy ?? receipt.error ?? "同步失败，请重新扫描或重新配对。",
      detail: receipt.recoveryDetail ?? receipt.error,
      retryRequest: receipt.retryRequest,
      action: receipt.recoveryActions?.includes("retry-sync") && receipt.retryRequest
        ? "retry-sync"
        : receipt.recoveryActions?.includes("repair-pairing") ? "repair-pairing" : "rescan"
    })),
    ...pendingConfirmations.slice(-2).reverse().map((confirmation) => ({
      kind: "pending",
      confirmationId: confirmation.id,
      requestRole: confirmation.requestRole ?? "sender",
      peerDeviceId: confirmation.peerDevice?.id,
      title: `待确认：${confirmation.peerDevice?.name ?? "未知设备"}`,
      copy: `将发送 ${confirmation.preview?.sendChanges ?? 0} 条，接收 ${confirmation.preview?.receiveChanges ?? 0} 条，确认后才同步。`,
      action: "review-sync"
    })),
    ...trustedDeviceSummaries.slice(0, 2).map((device) => ({
      kind: "trusted",
      title: `可信设备：${device.name}`,
      copy: `${device.statusLabel} · 指纹 ${device.publicKeyFingerprint}`,
      action: device.status === "needs-repairing" ? "repair-pairing" : "rescan"
    })),
    ...revocations.slice(-1).reverse().map((event) => ({
      kind: "revoked",
      title: `已撤销：${event.deviceName}`,
      copy: `指纹 ${event.publicKeyFingerprint ?? "未知"} · 再次同步前需重新面对面配对。`,
      action: "repair-pairing"
    }))
  ].slice(0, 4);

  return {
    status,
    statusLabel: statusCopy[0],
    headline: "本地同步中心",
    guidance: statusCopy[1],
    actionLabel: statusCopy[2],
    trustedCount: trustedDeviceSummaries.length,
    revokedCount: revocations.length,
    failureCount: failures.length,
    pendingCount: pendingConfirmations.length,
    recentSuccessCount,
    candidatesCount: candidates.length,
    connectionState: input.connectionState,
    pendingConfirmations,
    items
  };
}

function createTrustedDeviceSummaries(devices = [], receipts = [], discovery) {
  const candidates = discovery?.candidates ?? [];
  return devices.map((device) => {
    const lastReceipt = receipts
      .filter((receipt) => receipt.peerDeviceId === device.id || receipt.senderDeviceId === device.id || receipt.receiverDeviceId === device.id)
      .at(-1);
    const candidate = candidates.find((item) => item.device?.id === device.id);
    const needsRepairing = candidate?.requiresRepairing === true || candidate?.trustStatus === "needs-repairing";
    return {
      id: device.id,
      name: device.name,
      kind: device.kind,
      trustedAt: device.trustedAt,
      lastSeenAt: candidate?.discoveredAt ?? device.lastSeenAt,
      lastSyncAt: lastReceipt?.syncedAt ?? lastReceipt?.receivedAt,
      status: needsRepairing ? "needs-repairing" : "trusted",
      statusLabel: needsRepairing ? "需要重新配对" : "已信任",
      publicKeyFingerprint: createDeviceKeyFingerprint(device.publicKeyBase64),
      reason: needsRepairing
        ? "近场扫描发现设备密钥与可信列表不一致，请面对面重新确认 6 位码。"
        : "同步前仍会显示设备名、时间和变更摘要。",
      actionLabel: needsRepairing ? "重新配对" : "同步确认"
    };
  });
}

function createDeviceKeyFingerprint(publicKeyBase64 = "") {
  let hash = 2166136261;
  for (let index = 0; index < publicKeyBase64.length; index += 1) {
    hash ^= publicKeyBase64.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").match(/.{1,4}/g).join("-");
}

async function createTabletShellNearFieldDiscoveryFromRuntime(runtime, input = {}) {
  const desktopBaseUrl = input.desktopBaseUrl ?? process.env.LOGINTO_DESKTOP_SYNC_BASE_URL ?? "http://127.0.0.1:4173";
  const transportPlan = sync.createNearFieldTransportPlan({
    availableTransports: [input.transport ?? "local-network"],
    recommendedTransport: input.transport ?? "local-network"
  });
  const fallbackDevice = {
    id: "device_desktop_shell",
    name: "LoginTo Desktop Shell",
    kind: "desktop",
    publicKeyBase64: "unknown-desktop-key"
  };
  const probed = await sync.createNearFieldDiscoverySnapshotFromProbeTargets({
    localDeviceId: runtime.localDevice.id,
    scannedAt: input.scannedAt ?? now(),
    trustedDevices: runtime.syncSession.trustedDevices.list(),
    timeoutMs: input.timeoutMs ?? 1_000,
    targets: Array.isArray(input.hosts) && Array.isArray(input.ports)
      ? sync.createNearFieldEndpointProbeTargets({
        hosts: input.hosts,
        ports: input.ports,
        transport: input.transport ?? "local-network",
        expectedProduct: "LoginTo desktop shell",
        expectedKind: "desktop",
        includeFallbackCandidate: false,
        maxTargets: input.maxTargets ?? 24
      })
      : [
        {
          endpoint: desktopBaseUrl,
          transport: input.transport ?? "local-network",
          expectedProduct: "LoginTo desktop shell",
          expectedKind: "desktop",
          fallbackDevice,
          includeFallbackCandidate: true
        }
      ]
  });
  const receipts = input.syncReceipts ?? await loadSyncReceipts();
  const candidates = probed.candidates.map((candidate) => {
    const lastReceipt = receipts
      .filter((receipt) => receipt.peerDeviceId === candidate.device.id || receipt.senderDeviceId === candidate.device.id || receipt.receiverDeviceId === candidate.device.id)
      .at(-1);
    return {
      ...candidate,
      lastReceiptAt: lastReceipt?.syncedAt ?? lastReceipt?.receivedAt ?? candidate.lastReceiptAt
    };
  });
  return {
    ...sync.createNearFieldDiscoverySnapshot({
      localDeviceId: runtime.localDevice.id,
      scannedAt: input.scannedAt ?? now(),
      candidates
    }),
    probes: probed.probes,
    transportPlan,
    channels: [
      { id: "local-network", label: "局域网", status: "available" },
      { id: "hotspot", label: "手机热点", status: "planned" },
      { id: "bluetooth", label: "蓝牙", status: "planned" }
    ]
  };
}

async function fetchRemoteSyncSummary(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/sync/summary`, {
      signal: AbortSignal.timeout(1_000)
    });
    if (!response.ok) {
      return undefined;
    }
    return response.json();
  } catch {
    return undefined;
  }
}

async function sendSyncRequestToPeer(baseUrl, payload) {
  try {
    const response = await fetch(`${baseUrl}/api/sync/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1_500)
    });
    return {
      ok: response.ok,
      status: response.status,
      deliveredAt: now()
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message ?? String(error),
      deliveredAt: now()
    };
  }
}

async function sendSyncRequestResultToPeer(baseUrl, payload) {
  if (!baseUrl) {
    return { ok: false, error: "missing peer base url", deliveredAt: now() };
  }
  try {
    const response = await fetch(`${baseUrl}/api/sync/request-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1_500)
    });
    const data = await response.json().catch(() => undefined);
    return {
      ok: response.ok,
      status: response.status,
      data,
      deliveredAt: now()
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message ?? String(error),
      deliveredAt: now()
    };
  }
}

function requireLocalPeerBaseUrl(baseUrl, label = "sync peer") {
  try {
    const url = new URL(String(baseUrl ?? ""));
    const host = url.hostname.toLowerCase();
    const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    const octets = match?.slice(1).map((part) => Number(part));
    const privateIpv4 = octets?.every((part) => part >= 0 && part <= 255) && (
      octets[0] === 127
      || octets[0] === 10
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    );
    const local = url.protocol === "http:" && (
      host === "localhost"
      || host === "::1"
      || host === "[::1]"
      || privateIpv4
    );
    if (local) return url.toString().replace(/\/$/, "");
  } catch {
    // fall through to the shared public-network error
  }
  throw new Error(`${label} must use a local peer address; public network sync is not allowed`);
}

function createInboundSyncRequestConfirmation(input) {
  if (!input.confirmation) {
    throw new Error("Sync request confirmation is required");
  }
  const original = input.confirmation;
  return {
    ...original,
    id: `incoming_${original.id}`,
    sourceConfirmationId: original.id,
    status: "pending",
    direction: `incoming-${original.direction ?? "sync-request"}`,
    requestRole: "receiver",
    receivedAt: input.receivedAt,
    localDevice: input.localDevice,
    peerDevice: input.peerDevice,
    peerBaseUrl: input.peerBaseUrl ?? original.senderBaseUrl ?? original.peerBaseUrl,
    review: {
      ...(original.review ?? {}),
      peerDeviceId: input.peerDevice.id,
      peerDeviceName: input.peerDevice.name,
      peerBaseUrl: input.peerBaseUrl ?? original.senderBaseUrl ?? original.peerBaseUrl,
      peerKeyFingerprint: createDeviceKeyFingerprint(input.peerDevice.publicKeyBase64),
      requestedAt: original.requestedAt,
      expiresAt: original.expiresAt,
      transport: original.transport ?? "local-network",
      publicNetworkLogin: false
    }
  };
}

async function discoverDesktopDevice(baseUrl) {
  const summary = await fetchRemoteSyncSummary(baseUrl);
  if (summary?.device?.id && summary.device.publicKeyBase64) {
    return summary.device;
  }
  try {
    const response = await fetch(`${baseUrl}/api/app-state`, {
      signal: AbortSignal.timeout(1_000)
    });
    if (!response.ok) {
      return undefined;
    }
    await response.json();
  } catch {
    return undefined;
  }
  return undefined;
}

async function requireSyncConfirmation(input) {
  if (!input.confirmationId) {
    throw new Error("Sync confirmation is required before exchanging packages");
  }
  const confirmations = await loadSyncConfirmations();
  const confirmation = confirmations.find((item) => item.id === input.confirmationId);
  if (!confirmation) {
    throw new Error(`Sync confirmation does not exist: ${input.confirmationId}`);
  }
  if (confirmation.status !== "pending") {
    throw new Error(`Sync confirmation is not pending: ${confirmation.status}`);
  }
  if (confirmation.peerDevice.id !== input.expectedPeerDeviceId) {
    throw new Error("Sync confirmation peer does not match target device");
  }
  if (Date.parse(confirmation.expiresAt) <= Date.parse(input.now)) {
    throw new Error("Sync confirmation has expired");
  }
  return confirmation;
}

async function markSyncConfirmationConfirmed(confirmationId, confirmedAt) {
  const confirmations = await loadSyncConfirmations();
  const updated = confirmations.map((item) => item.id === confirmationId
    ? { ...item, status: "confirmed", confirmedAt }
    : item);
  await saveSyncConfirmations(updated);
}

async function markSyncConfirmationFailed(confirmationId, failedAt) {
  const confirmations = await loadSyncConfirmations();
  const updated = confirmations.map((item) => item.id === confirmationId
    ? { ...item, status: "failed", failedAt }
    : item);
  await saveSyncConfirmations(updated);
}

async function loadSyncConfirmations() {
  try {
    const json = await readFile(getSyncConfirmationPath(), "utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.confirmations) ? parsed.confirmations : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveSyncConfirmations(confirmations) {
  const path = getSyncConfirmationPath();
  await writeJsonFileAtomically(path, { confirmations });
}

function addSeconds(iso, seconds) {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

async function loadSyncReceipts() {
  try {
    const json = await readFile(getSyncReceiptPath(), "utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveSyncReceipts(receipts) {
  const path = getSyncReceiptPath();
  await writeJsonFileAtomically(path, { receipts });
}

async function loadTrustedDeviceRevocations() {
  try {
    const json = await readFile(getTrustedDeviceRevocationPath(), "utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.revocations) ? parsed.revocations : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function appendTrustedDeviceRevocation(event) {
  const revocations = await loadTrustedDeviceRevocations();
  revocations.push(event);
  const path = getTrustedDeviceRevocationPath();
  await writeJsonFileAtomically(path, { revocations: revocations.slice(-50) });
}

async function decryptShellSyncExchangePackage(encryptedPackage, localDevice, peerDevice) {
  const adapter = crypto.createWebCryptoAesGcmAdapter();
  const key = await deriveShellSyncPackageKey(adapter, encryptedPackage, localDevice, peerDevice);
  return sync.decryptSyncExchangePackage({ encryptedPackage, adapter, key });
}

async function encryptShellSyncExchangePackage(exchangePackage, localDevice, peerDevice) {
  const adapter = crypto.createWebCryptoAesGcmAdapter();
  const key = await deriveShellSyncPackageKey(adapter, exchangePackage, localDevice, peerDevice);
  return sync.encryptSyncExchangePackage({ exchangePackage, adapter, key });
}

async function deriveShellSyncPackageKey(adapter, packageLike, localDevice, peerDevice) {
  const devicePairMaterial = createDevicePairSyncKeyMaterial(localDevice, peerDevice);
  const saltText = [
    "loginto-paired-device-sync-session-v1",
    devicePairMaterial.pairId,
    packageLike.senderDeviceId,
    packageLike.receiverDeviceId ?? "",
    packageLike.sessionId ?? "",
    packageLike.confirmationId ?? ""
  ].join(":");
  return adapter.deriveKey(devicePairMaterial.keySeed, {
    ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
    saltBase64: Buffer.from(saltText).toString("base64")
  });
}

function createDevicePairSyncKeyMaterial(localDevice, peerDevice) {
  const devices = [localDevice, peerDevice]
    .map((device) => ({
      id: device?.id ?? "",
      kind: device?.kind ?? "",
      publicKeyBase64: device?.publicKeyBase64 ?? ""
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const pairId = devices.map((device) => `${device.kind}:${device.id}`).join("|");
  const publicKeys = devices.map((device) => device.publicKeyBase64).join("|");
  return {
    pairId,
    keySeed: `loginto-paired-device-sync-key-v1:${pairId}:${publicKeys}`
  };
}

async function loadLocalDeviceIdentity(input) {
  try {
    const parsed = JSON.parse(await readFile(input.path, "utf8"));
    const publicKeyBase64 = shouldRotateLocalPublicKey(parsed.publicKeyBase64, input.legacyPublicKeyBase64)
      ? createLocalDevicePublicKeyBase64()
      : parsed.publicKeyBase64;
    const device = sync.createDeviceIdentity({
      id: parsed.id,
      name: parsed.name ?? input.name,
      kind: parsed.kind ?? input.kind,
      publicKeyBase64,
      now,
      ids
    });
    if (device.publicKeyBase64 !== parsed.publicKeyBase64 || device.name !== parsed.name || device.kind !== parsed.kind) {
      await writeLocalDeviceIdentity(input.path, device);
    }
    return device;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  const device = sync.createDeviceIdentity({
    id: ids.nextId("device"),
    name: input.name,
    kind: input.kind,
    publicKeyBase64: createLocalDevicePublicKeyBase64(),
    now,
    ids
  });
  await writeLocalDeviceIdentity(input.path, device);
  return device;
}

function shouldRotateLocalPublicKey(publicKeyBase64, legacyPublicKeyBase64) {
  return !publicKeyBase64 || publicKeyBase64 === legacyPublicKeyBase64;
}

function requireDiscoveredPublicKey(publicKeyBase64, label) {
  if (!publicKeyBase64) {
    throw new Error(`Cannot sync with ${label}: missing peer public key. Pair face-to-face while both devices are connected.`);
  }
  return publicKeyBase64;
}

function createLocalDevicePublicKeyBase64() {
  return randomBytes(32).toString("base64");
}

async function writeLocalDeviceIdentity(path, device) {
  await writeJsonFileAtomically(path, device);
}
