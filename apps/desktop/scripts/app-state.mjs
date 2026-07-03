import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDesktopReminderNotificationAdapter,
  getDesktopReminderNotificationDispatchLogPath,
  readDesktopReminderNotificationDispatchLog
} from "./notification-bridge.mjs";

const desktopRuntime = await import("../src/runtime.ts");
const crypto = await import("../../../packages/crypto-core/src/index.ts");
const sync = await import("../../../packages/sync-core/src/index.ts");
const vault = await import("../../../packages/vault-core/src/index.ts");
const desktopNetwork = await import("../src/local-network-transport.ts");

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = normalize(join(__dirname, "..", "..", ".."));
const now = () => "2026-06-06T18:00:00.000Z";
const shellNow = "2026-12-20T09:00:00.000Z";
const defaultVaultPath = join(workspaceRoot, ".tmp", "desktop-shell-preview.vault-snapshot.json");
const defaultRuntimeStatePath = join(workspaceRoot, ".tmp", "desktop-shell-preview.runtime-state.json");
const defaultSyncReceiptPath = join(workspaceRoot, ".tmp", "terminal-sync-receipts.json");
const defaultDeviceIdentityPath = join(workspaceRoot, ".tmp", "desktop-shell-preview.device-identity.json");
const defaultSyncConfirmationPath = join(workspaceRoot, ".tmp", "desktop-sync-confirmations.json");
const defaultTrustedDeviceRevocationPath = join(workspaceRoot, ".tmp", "desktop-trusted-device-revocations.json");
const defaultBackupPackagePath = join(workspaceRoot, ".tmp", "desktop-shell-preview.backup-package.json");
const defaultBackupVerifyVaultPath = join(workspaceRoot, ".tmp", "desktop-shell-preview.backup-verify.vault-snapshot.json");
const defaultBackupVerifySqliteVaultPath = join(workspaceRoot, ".tmp", "desktop-shell-preview.backup-verify.sqlite");
const defaultBackupVerifyRuntimeStatePath = join(workspaceRoot, ".tmp", "desktop-shell-preview.backup-verify.runtime-state.json");
const password = "desktop-shell-preview-password";
const saltBase64 = Buffer.alloc(16).toString("base64");

async function writeTextFileAtomically(path, text) {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  try {
    await writeFile(tempPath, text, "utf8");
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

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

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_desktop_${Date.now().toString(36)}_${this.value}`;
  }
};

const seedRecords = [
  {
    type: "account",
    title: "GitHub",
    values: {
      username: "github-user",
      password: "github-secret-2026",
      otp_backup: "ABCD-EFGH-IJKL",
      url: "https://github.com",
      notes: "Primary account, 2FA enabled, backup codes encrypted."
    },
    ui: {
      id: "github",
      type: "account",
      subtitle: "网站账号 · 最近更新 10:36 · 已加密保存",
      icon: "＠",
      badge: "已同步",
      badgeTone: "sync",
      fields: [
        { label: "用户名", value: "github-user" },
        { label: "密码", value: "••••••••••••", secret: true, sensitivity: "secret" },
        { label: "2FA 备用码", value: "••••-••••-••••", secret: true, sensitivity: "critical" },
        { label: "登录网址", value: "https://github.com" },
        { label: "备注", value: "主账号，启用 2FA，备份码已加密保存。" }
      ]
    }
  },
  {
    type: "membership",
    title: "Airport Lounge VIP",
    values: {
      member_name: "Airport Lounge VIP",
      member_id: "LOUNGE-2026",
      expires_at: "2026-12-31T00:00:00.000Z",
      service_phone: "400-555-0101"
    },
    reminderDrafts: [
      {
        dueAt: "2026-12-24T09:00:00.000Z",
        message: "Airport Lounge VIP 7 天后到期",
        daysBefore: 7
      }
    ],
    ui: {
      id: "lounge",
      type: "member",
      subtitle: "会员信息 · OCR 拍照生成 · 2026-12-31 到期",
      icon: "★",
      badge: "到期",
      badgeTone: "warn",
      fields: [
        { label: "会员名称", value: "Airport Lounge VIP" },
        { label: "会员号", value: "LOUNGE-2026" },
        { label: "到期时间", value: "2026-12-31 00:00" },
        { label: "客服电话", value: "400-555-0101" }
      ]
    }
  },
  {
    type: "bank_card",
    title: "招商银行储蓄卡",
    values: {
      cardholder: "张先生",
      card_number: "6225 8800 0000 0826",
      bank_name: "招商银行",
      statement_day: "25",
      notes: "每月 25 日 09:00 账单提醒"
    },
    reminderDrafts: [
      {
        dueAt: "2026-06-25T09:00:00.000Z",
        message: "招商银行储蓄卡账单日提醒",
        daysBefore: 0
      }
    ],
    ui: {
      id: "card",
      type: "bank",
      subtitle: "银行卡 · 本机保存 · 不默认记录 CVV",
      icon: "▣",
      badge: "本机",
      badgeTone: "",
      fields: [
        { label: "持卡人", value: "张先生" },
        { label: "卡号", value: "6225 **** **** 0826", secret: true, sensitivity: "secret" },
        { label: "开户行", value: "招商银行" },
        { label: "账单提醒", value: "每月 25 日 09:00" }
      ]
    }
  },
  {
    type: "identity_document",
    title: "护照",
    values: {
      document_type: "护照",
      document_number: "E12345678",
      expires_at: "2028-09-12T00:00:00.000Z",
      issued_by: "Exit & Entry Administration",
      notes: "持有人：Zhang"
    },
    reminderDrafts: [
      {
        dueAt: "2028-09-12T09:00:00.000Z",
        message: "护照即将到期",
        daysBefore: 30
      }
    ],
    ui: {
      id: "passport",
      type: "id",
      subtitle: "证件 · 附件已加密 · 需要二次解锁查看编号",
      icon: "◇",
      badge: "附件",
      badgeTone: "",
      fields: [
        { label: "姓名", value: "Zhang" },
        { label: "证件号", value: "E********", secret: true, sensitivity: "critical" },
        { label: "到期时间", value: "2028-09-12" },
        { label: "附件", value: "护照照片 1 张，加密 blob" }
      ]
    }
  }
];

const fallbackTypeUi = {
  account: { type: "account", icon: "＠", badge: "本机", badgeTone: "sync" },
  bank_card: { type: "bank", icon: "▣", badge: "本机", badgeTone: "" },
  membership: { type: "member", icon: "★", badge: "新增", badgeTone: "sync" },
  identity_document: { type: "id", icon: "◇", badge: "本机", badgeTone: "" },
  secret_key: { type: "id", icon: "◇", badge: "密钥", badgeTone: "secret" },
  custom: { type: "account", icon: "▦", badge: "自定义", badgeTone: "" }
};

export async function createDesktopShellAppState(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const syncReceipts = await loadSyncReceipts(input.syncReceiptPath);
  const confirmations = await loadSyncConfirmations(input.syncConfirmationPath);
  const trustedDeviceRevocations = await loadTrustedDeviceRevocations(input.trustedDeviceRevocationPath);
  const notificationDispatches = await readDesktopReminderNotificationDispatchLog(input);

  const records = runtime.session.getRecords();
  const dueAlerts = runtime.getDueReminderPopups(shellNow);
  const upcomingAlerts = runtime.getUpcomingReminderPopups(shellNow, 45);
  const dueNotifications = await runtime.collectDueReminderNotifications(shellNow);
  const runtimeState = runtime.reminderNotifications.snapshot("2026-12-20T09:00:30.000Z");
  const selectedReminder = selectReminderModalState(dueAlerts, dueNotifications, runtimeState.deliveries);
  const uiRecords = createUiRecordsFromRuntime(records);
  const pairingPreview = createDesktopShellPairingPreviewFromRuntime(runtime);
  const discovery = await createDesktopShellNearFieldDiscoveryFromRuntime(runtime, {
    syncReceipts
  });
  const trustedDeviceSummaries = createTrustedDeviceSummaries(
    runtime.syncSession.trustedDevices.list(),
    syncReceipts,
    discovery
  );
  const recentReceipts = createRecentSyncReceiptSummaries(syncReceipts);
  const pendingConfirmations = confirmations.filter((item) => item.status === "pending");
  const connectionState = sync.createNearFieldConnectionState({
    discovery,
    pendingConfirmations,
    recentReceipts,
    now: shellNow
  });

  return {
    vault: {
      name: runtime.session.repository.getManifest().name,
      deviceId: runtime.localDevice.id,
      records: records.length,
      dueReminders: dueAlerts.length,
      notificationStateVersion: runtimeState.stateVersion,
      vaultPath: input.vaultPath ?? getVaultPath(),
      runtimeStatePath: input.runtimeStatePath ?? getRuntimeStatePath(),
      storageKind: input.storageKind ?? getStorageKind(),
      sqliteVaultPath: input.sqliteVaultPath ?? getSqliteVaultPath()
    },
    nav: [
      { type: "all", label: "全部记录", icon: "▦", count: uiRecords.length },
      { type: "account", label: "网站账号", icon: "＠", count: uiRecords.filter((record) => record.type === "account").length },
      { type: "bank", label: "银行卡", icon: "▣", count: uiRecords.filter((record) => record.type === "bank").length },
      { type: "member", label: "会员信息", icon: "★", count: uiRecords.filter((record) => record.type === "member").length },
      { type: "id", label: "证件密钥", icon: "◇", count: uiRecords.filter((record) => record.type === "id").length }
    ],
    records: uiRecords,
    selectedRecordId: selectUiRecordId(uiRecords, input.selectedRecordId),
    reminderModal: {
      title: selectedReminder.popupTitle,
      alertId: selectedReminder.alertId,
      recordTitle: selectedReminder.recordTitle,
      body: selectedReminder.popupBody,
      status: selectedReminder.status,
      deliveries: runtimeState.deliveries.length
    },
    reminderCenter: createDesktopReminderCenter(dueNotifications, dueAlerts, upcomingAlerts, runtimeState),
    sync: {
      ...pairingPreview,
      desktopStatus: "pairing-open",
      phoneStatus: "waiting-scan",
      transport: "local-network",
      appliedChanges: runtime.syncSession.changeLog.list().length,
      trustedDevices: runtime.syncSession.trustedDevices.list().length,
      trustedDeviceSummaries,
      trustedDeviceRevocations: trustedDeviceRevocations.slice(-10).reverse(),
      lastReceipt: syncReceipts.at(-1),
      lastReceiptSummary: createSyncReceiptSummary(syncReceipts.at(-1)),
      recentReceipts,
      pendingConfirmation: pendingConfirmations.at(-1),
      connectionState,
      syncCenter: createSyncCenterSummary({
        trustedDeviceSummaries,
        revocations: trustedDeviceRevocations,
        receipts: syncReceipts,
        confirmations,
        discovery,
        connectionState
      }),
      discovery
    },
    phonePreview: {
      title: "拍照录入",
      body: "OCR 识别会员号、到期日、客服电话，确认后写入保险箱。",
      attachmentStatus: "图片已加密"
    },
    backup: {
      status: "ready",
      format: "loginto-vault-package-v1",
      targetPath: input.backupPackagePath ?? getBackupPackagePath()
    },
    security: runtime.security.snapshot(shellNow),
    notificationBridge: {
      status: "ready",
      dispatchLogPath: input.dispatchLogPath ?? getDesktopReminderNotificationDispatchLogPath(),
      dispatched: notificationDispatches.length,
      lastDispatch: notificationDispatches.at(-1)
    }
  };
}

function createDesktopReminderCenter(dueNotifications, dueAlerts, upcomingAlerts, runtimeState) {
  const deliveryByAlertId = new Map(runtimeState.deliveries.map((delivery) => [delivery.alertId, delivery]));
  const dueAlertIds = new Set(dueNotifications.map((delivery) => delivery.alertId));
  const pending = dueNotifications.map((delivery) => toDesktopReminderCenterItem({
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
  const fallbackDue = dueAlerts
    .map((alert) => ({ alert, alertId: createDesktopReminderAlertId(alert) }))
    .filter(({ alertId }) => !dueAlertIds.has(alertId))
    .map(({ alert, alertId }) => toDesktopReminderCenterItem({
      alertId,
      recordId: alert.recordId,
      reminderId: alert.id,
      recordTitle: alert.recordTitle,
      title: alert.title,
      body: alert.body,
      dueAt: alert.dueAt,
      triggerAt: alert.triggerAt,
      status: alert.status,
      source: "due"
    }, deliveryByAlertId.get(alertId)));
  const allDueIds = new Set([...dueAlertIds, ...fallbackDue.map((item) => item.alertId)]);
  const upcoming = upcomingAlerts
    .map((alert) => ({ alert, alertId: createDesktopReminderAlertId(alert) }))
    .filter(({ alertId }) => !allDueIds.has(alertId))
    .map(({ alert, alertId }) => toDesktopReminderCenterItem({
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
    }, deliveryByAlertId.get(alertId)));
  const history = runtimeState.deliveries
    .filter((delivery) => !allDueIds.has(delivery.alertId) && ["completed", "snoozed", "dismissed"].includes(delivery.status))
    .slice(-8)
    .map((delivery) => toDesktopReminderCenterItem({
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
  const due = [...pending, ...fallbackDue];
  const items = [...due, ...upcoming, ...history];
  return {
    filters: [
      { id: "all", label: "全部", count: items.length },
      { id: "due", label: "到期", count: due.length },
      { id: "upcoming", label: "即将", count: upcoming.length },
      { id: "history", label: "已处理", count: history.length }
    ],
    due,
    upcoming,
    history,
    items
  };
}

function toDesktopReminderCenterItem(alert, delivery) {
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

function createDesktopReminderAlertId(alert) {
  return ["reminder", alert.recordId, alert.id, alert.triggerAt].join(":");
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

export async function createDesktopShellSyncPreview(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const target = await normalizeDesktopSyncTarget(input);
  requireTrustedSyncPeer(runtime, target.device);
  await appendRecordSyncChanges(runtime, input.requestedAt ?? shellNow, input.syncDeletionPath);
  await runtime.saveRuntimeState(input.requestedAt ?? shellNow);
  const localSummary = runtime.syncSession.getLocalSummary();
  const localRecords = await summarizeDesktopRecordsWithTombstones(runtime, input.syncDeletionPath);
  const remote = await fetchRemoteSyncSummary(target);
  const confirmation = createSyncConfirmation({
    direction: `desktop-to-${target.kind}`,
    localDevice: runtime.localDevice,
    peerDevice: target.device,
    peerBaseUrl: target.baseUrl,
    requestedAt: input.requestedAt ?? shellNow,
    localSummary,
    remoteSummary: remote?.summary,
    localRecords,
    remoteRecords: remote?.records,
    transport: "local-network"
  });
  const confirmations = await loadSyncConfirmations(input.syncConfirmationPath);
  confirmations.push(confirmation);
  await saveSyncConfirmations(confirmations.slice(-20), input.syncConfirmationPath);
  const requestDelivery = await sendSyncRequestToPeer(target.baseUrl, {
    senderDevice: runtime.localDevice,
    senderBaseUrl: input.senderBaseUrl ?? process.env.LOGINTO_DESKTOP_SYNC_BASE_URL ?? "http://127.0.0.1:4173",
    confirmation
  });
  if (!requestDelivery.ok) {
    await markSyncConfirmationFailed(confirmation.id, requestDelivery.deliveredAt, input.syncConfirmationPath);
    await saveFailedDesktopSyncRequestReceipt({ input, runtime, target, confirmation, requestDelivery });
  }
  return {
    ok: true,
    confirmation,
    requestDelivery,
    appState: await createDesktopShellAppState(input)
  };
}

export async function receiveDesktopShellSyncRequest(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
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
    receivedAt: input.receivedAt ?? shellNow
  });
  const confirmations = await loadSyncConfirmations(input.syncConfirmationPath);
  const withoutDuplicate = confirmations.filter((item) => item.id !== inbound.id);
  withoutDuplicate.push(inbound);
  await saveSyncConfirmations(withoutDuplicate.slice(-20), input.syncConfirmationPath);
  return {
    ok: true,
    confirmation: inbound,
    appState: await createDesktopShellAppState(input)
  };
}

export async function createDesktopShellNearFieldDiscovery(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  return createDesktopShellNearFieldDiscoveryFromRuntime(runtime, {
    scannedAt: input.scannedAt,
    syncReceipts: await loadSyncReceipts(input.syncReceiptPath),
    targets: input.targets,
    hosts: input.hosts,
    ports: input.ports,
    timeoutMs: input.timeoutMs
  });
}

export async function resolveDesktopShellDiscoveryCandidateAction(input = {}) {
  const discovery = input.candidate ? input.discovery : await createDesktopShellNearFieldDiscovery(input);
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
      pairing: await createDesktopShellPairingPreview(input),
      message: "设备密钥已变化，需要面对面重新配对"
    };
  }
  if (candidate.requiresPairing || candidate.trustStatus === "needs-pairing") {
    return {
      ok: true,
      action: "pair",
      candidate,
      pairing: await createDesktopShellPairingPreview(input),
      message: "首次连接需要面对面配对"
    };
  }
  const targetKind = candidate.device.kind === "tablet" ? "tablet" : "phone";
  return {
    ok: true,
    action: "sync-preview",
    candidate,
    nextRequest: {
      targetKind,
      targetBaseUrl: candidate.endpoint,
      targetDeviceId: candidate.device.id,
      targetDeviceName: candidate.device.name,
      targetPublicKeyBase64: candidate.device.publicKeyBase64
    },
    message: `可信设备 ${candidate.device.name} 可进入同步确认`
  };
}

export async function exportDesktopShellBackupPackage(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const backupPackage = await runtime.exportEncryptedBackupPackage();
  const packageJson = runtime.serializeEncryptedBackupPackage(backupPackage);
  const savedPath = input.backupPackagePath ?? getBackupPackagePath();
  await writeTextFileAtomically(savedPath, packageJson);
  return {
    ok: true,
    savedPath,
    packageJson,
    summary: createBackupPackageSummary(backupPackage, packageJson, runtime.session.getRecords().length)
  };
}

export async function verifyDesktopShellBackupPackage(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const packageJson = input.packageJson ?? await readFile(input.backupPackagePath ?? getBackupPackagePath(), "utf8");
  const restored = await desktopRuntime.restoreDesktopRuntimeFromEncryptedBackup({
    vaultPath: input.verifyVaultPath ?? getBackupVerifyVaultPath(),
    storageKind: input.verifyStorageKind ?? input.storageKind ?? getStorageKind(),
    sqliteVaultPath: input.verifySqliteVaultPath ?? getBackupVerifySqliteVaultPath(input.verifyVaultPath ?? getBackupVerifyVaultPath()),
    runtimeStatePath: input.verifyRuntimeStatePath ?? getBackupVerifyRuntimeStatePath(),
    packageJson,
    password,
    vaultName: "LoginTo Desktop Backup Verify",
    localDevice: runtime.localDevice,
    saltBase64: runtime.cryptoState.kdfParams.saltBase64,
    kdfIterations: 20_000,
    now,
    ids
  });
  const restoredRecords = restored.session.getRecords();
  const duePopups = restored.getDueReminderPopups(shellNow);
  return {
    ok: true,
    verifiedAt: shellNow,
    summary: {
      records: restoredRecords.length,
      attachments: restoredRecords.reduce((count, record) => count + record.attachments.length, 0),
      dueReminders: duePopups.length,
      vaultPath: input.verifyVaultPath ?? getBackupVerifyVaultPath(),
      storageKind: input.verifyStorageKind ?? input.storageKind ?? getStorageKind(),
      sqliteVaultPath: input.verifySqliteVaultPath ?? getBackupVerifySqliteVaultPath(input.verifyVaultPath ?? getBackupVerifyVaultPath()),
      runtimeStatePath: input.verifyRuntimeStatePath ?? getBackupVerifyRuntimeStatePath()
    }
  };
}

export async function receiveDesktopShellSyncPackage(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const senderDevice = input.senderDevice ?? {
    id: input.encryptedPackage?.senderDeviceId,
    name: "Unknown Sync Sender",
    kind: "phone",
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
  await appendRecordSyncChanges(runtime, input.receivedAt ?? shellNow, input.input?.syncDeletionPath ?? input.syncDeletionPath);
  const report = runtime.syncSession.receiveExchangePackage({
    exchangePackage,
    transport: input.transport ?? "local-network",
    decisions: input.decisions,
    now: () => input.receivedAt ?? shellNow,
    ids
  });
  applyRecordSyncPayloadsToDesktopVault(runtime, exchangePackage, report, input.decisions ?? []);
  await runtime.session.save();
  await runtime.saveRuntimeState(input.receivedAt ?? shellNow);
  const receipt = {
    id: ids.nextId("sync_receipt"),
    direction: "incoming",
    status: "success",
    syncedAt: input.receivedAt ?? shellNow,
    receivedAt: input.receivedAt ?? shellNow,
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
  const receipts = await loadSyncReceipts(input.syncReceiptPath);
  receipts.push(receipt);
  await saveSyncReceipts(receipts.slice(-20), input.syncReceiptPath);
  return {
    ok: true,
    receipt,
    report,
    appState: await createDesktopShellAppState(input)
  };
}

export async function pushDesktopShellSyncToTerminal(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const target = await normalizeDesktopSyncTarget(input);
  const confirmation = await requireSyncConfirmation({
    confirmationId: input.confirmationId,
    expectedPeerDeviceId: target.device.id,
    path: input.syncConfirmationPath,
    now: input.syncedAt ?? shellNow
  });
  requireTrustedSyncPeer(runtime, target.device);
  await assertSyncConfirmationStillCurrent({
    confirmation,
    localRecords: await summarizeDesktopRecordsWithTombstones(runtime, input.syncDeletionPath),
    remoteRecords: (await fetchRemoteSyncSummary(target))?.records ?? []
  });
  await appendRecordSyncChanges(runtime, input.syncedAt ?? shellNow, input.syncDeletionPath);
  const exchangePackage = runtime.syncSession.createOutgoingExchangePackage({
    receiverDeviceId: target.device.id,
    sessionId: confirmation.sessionId,
    confirmationId: confirmation.id,
    now: () => input.syncedAt ?? shellNow,
    ids
  });
  const encryptedPackage = await encryptShellSyncExchangePackage(exchangePackage, runtime.localDevice, target.device);
  let targetResult;
  try {
    const response = await fetch(`${target.baseUrl}/api/sync/receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        senderDevice: runtime.localDevice,
        encryptedPackage,
        transport: "local-network",
        receivedAt: input.syncedAt ?? shellNow,
        decisions: input.decisions ?? []
      })
    });
    if (!response.ok) {
      throw await createSyncReceiveFailureError(response, "Target sync receive failed");
    }
    targetResult = await response.json();
  } catch (error) {
    await saveFailedDesktopOutgoingSyncReceipt({
      input,
      runtime,
      target,
      exchangePackage,
      error,
      syncedAt: input.syncedAt ?? shellNow
    });
    await markSyncConfirmationFailed(confirmation.id, input.syncedAt ?? shellNow, input.syncConfirmationPath);
    throw error;
  }
  await runtime.saveRuntimeState(input.syncedAt ?? shellNow);
  await markSyncConfirmationConfirmed(confirmation.id, input.syncedAt ?? shellNow, input.syncConfirmationPath);
  const outgoingReceipt = {
    id: ids.nextId("sync_receipt"),
    direction: "outgoing",
    status: "success",
    syncedAt: input.syncedAt ?? shellNow,
    peerDeviceId: target.device.id,
    peerName: target.device.name,
    senderDeviceId: runtime.localDevice.id,
    senderName: runtime.localDevice.name,
    receiverDeviceId: target.device.id,
    packageId: exchangePackage.packageId,
    sentCount: exchangePackage.changes.length,
    receivedCount: targetResult.receipt?.sentCount ?? 0,
    conflictCount: targetResult.receipt?.conflictCount ?? targetResult.receipt?.conflicts ?? 0,
    changes: exchangePackage.changes.length,
    appliedChanges: targetResult.receipt?.appliedChanges ?? 0,
    resolvedConflicts: targetResult.receipt?.resolvedConflicts ?? 0,
    conflicts: targetResult.receipt?.conflicts ?? 0,
    conflictResolutionSummary: targetResult.receipt?.conflictResolutionSummary ?? [],
    transport: targetResult.receipt?.transport ?? "local-network"
  };
  const receipts = await loadSyncReceipts(input.syncReceiptPath);
  receipts.push(outgoingReceipt);
  await saveSyncReceipts(receipts.slice(-20), input.syncReceiptPath);
  return {
    ok: true,
    target: target.kind,
    targetBaseUrl: target.baseUrl,
    packageId: exchangePackage.packageId,
    transportPackage: {
      protocol: encryptedPackage.protocol,
      encrypted: true,
      plaintextExchangeIncluded: false,
      ciphertextBytes: Buffer.from(encryptedPackage.cipher.ciphertextBase64, "base64").length
    },
    sentChanges: exchangePackage.changes.length,
    targetReceipt: targetResult.receipt,
    outgoingReceipt,
    appState: await createDesktopShellAppState(input)
  };
}

export async function simulateDesktopShellSyncFailure(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const failure = normalizeDemoSyncFailure(input.reason);
  const peer = createDesktopDemoFailurePeer(input);
  const receipt = createDemoSyncFailureReceipt({
    id: ids.nextId("sync_receipt"),
    syncedAt: input.syncedAt ?? shellNow,
    localDevice: runtime.localDevice,
    peer,
    targetKind: peer.kind === "tablet" ? "tablet" : "phone",
    targetBaseUrl: peer.baseUrl,
    failure
  });
  const receipts = await loadSyncReceipts(input.syncReceiptPath);
  receipts.push(receipt);
  await saveSyncReceipts(receipts.slice(-20), input.syncReceiptPath);
  return {
    ok: true,
    reason: failure.reason,
    receipt,
    appState: await createDesktopShellAppState(input)
  };
}

export async function actOnDesktopShellSyncConfirmation(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const action = input.action === "confirm" ? "confirm" : input.action === "timeout" ? "timeout" : "reject";
  const failure = normalizeDemoSyncFailure(action === "timeout" ? "timeout" : "peer-rejected");
  const confirmations = await loadSyncConfirmations(input.syncConfirmationPath);
  const confirmation = selectPendingSyncConfirmation(confirmations, input.confirmationId);
  const actedAt = input.actedAt ?? shellNow;
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
  await saveSyncConfirmations(updated, input.syncConfirmationPath);
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
      appState: await createDesktopShellAppState(input)
    };
  }
  const peer = confirmation.peerDevice ?? createDesktopDemoFailurePeer(input);
  const receipt = createDemoSyncFailureReceipt({
    id: ids.nextId("sync_receipt"),
    syncedAt: actedAt,
    localDevice: runtime.localDevice,
    peer,
    targetKind: peer.kind === "tablet" ? "tablet" : peer.kind === "desktop" ? "desktop" : "phone",
    targetBaseUrl: confirmation.peerBaseUrl ?? input.targetBaseUrl ?? createDesktopDemoFailurePeer(input).baseUrl,
    failure
  });
  const receipts = await loadSyncReceipts(input.syncReceiptPath);
  receipts.push(receipt);
  await saveSyncReceipts(receipts.slice(-20), input.syncReceiptPath);
  return {
    ok: true,
    action,
    confirmationId: confirmation.id,
    reason: failure.reason,
    receipt,
    resultDelivery,
    appState: await createDesktopShellAppState(input)
  };
}

export async function receiveDesktopShellSyncRequestResult(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const action = input.action === "confirm" ? "confirm" : input.action === "timeout" ? "timeout" : "reject";
  const actedAt = input.actedAt ?? shellNow;
  const confirmations = await loadSyncConfirmations(input.syncConfirmationPath);
  const confirmation = confirmations.find((item) => item.id === input.sourceConfirmationId);
  if (!confirmation) {
    throw new Error(`Sync request result target does not exist: ${input.sourceConfirmationId}`);
  }
  assertSyncRequestResultSender(confirmation, input.senderDevice);
  const failure = normalizeDemoSyncFailure(action === "timeout" ? "timeout" : "peer-rejected");
  if (action === "confirm") {
    const peer = confirmation.peerDevice ?? input.senderDevice ?? createDesktopDemoFailurePeer(input);
    const autoSync = await pushDesktopShellSyncToTerminal({
      ...input,
      confirmationId: confirmation.id,
      targetKind: peer.kind === "tablet" ? "tablet" : "phone",
      targetBaseUrl: confirmation.peerBaseUrl ?? input.targetBaseUrl,
      targetDeviceId: peer.id,
      targetDeviceName: peer.name,
      targetPublicKeyBase64: peer.publicKeyBase64,
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
  await saveSyncConfirmations(updated, input.syncConfirmationPath);
  let receipt;
  if (action !== "confirm") {
    const peer = confirmation.peerDevice ?? input.senderDevice ?? createDesktopDemoFailurePeer(input);
    receipt = createDemoSyncFailureReceipt({
      id: ids.nextId("sync_receipt"),
      syncedAt: actedAt,
      localDevice: runtime.localDevice,
      peer,
      targetKind: peer.kind === "tablet" ? "tablet" : peer.kind === "desktop" ? "desktop" : "phone",
      targetBaseUrl: confirmation.peerBaseUrl ?? input.targetBaseUrl ?? createDesktopDemoFailurePeer(input).baseUrl,
      failure
    });
    const receipts = await loadSyncReceipts(input.syncReceiptPath);
    receipts.push(receipt);
    await saveSyncReceipts(receipts.slice(-20), input.syncReceiptPath);
  }
  return {
    ok: true,
    action,
    confirmationId: confirmation.id,
    reason: action === "confirm" ? undefined : failure.reason,
    receipt,
    appState: await createDesktopShellAppState(input)
  };
}

async function saveFailedDesktopOutgoingSyncReceipt(input) {
  const failedReceipt = {
    id: ids.nextId("sync_receipt"),
    direction: "outgoing",
    status: "failure",
    syncedAt: input.syncedAt,
    peerDeviceId: input.target.device.id,
    peerName: input.target.device.name,
    senderDeviceId: input.runtime.localDevice.id,
    senderName: input.runtime.localDevice.name,
    receiverDeviceId: input.target.device.id,
    targetKind: input.target.kind,
    targetBaseUrl: input.target.baseUrl,
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
  const receipts = await loadSyncReceipts(input.input.syncReceiptPath);
  receipts.push(failedReceipt);
  await saveSyncReceipts(receipts.slice(-20), input.input.syncReceiptPath);
}

async function saveFailedDesktopSyncRequestReceipt(input) {
  const failedReceipt = {
    id: ids.nextId("sync_receipt"),
    direction: "outgoing",
    status: "failure",
    syncedAt: input.requestDelivery.deliveredAt,
    peerDeviceId: input.target.device.id,
    peerName: input.target.device.name,
    senderDeviceId: input.runtime.localDevice.id,
    senderName: input.runtime.localDevice.name,
    receiverDeviceId: input.target.device.id,
    targetKind: input.target.kind,
    targetBaseUrl: input.target.baseUrl,
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
  const receipts = await loadSyncReceipts(input.input.syncReceiptPath);
  receipts.push(failedReceipt);
  await saveSyncReceipts(receipts.slice(-20), input.input.syncReceiptPath);
}

function assertSyncRequestResultSender(confirmation, senderDevice) {
  const expectedId = confirmation.peerDevice?.id;
  if (!expectedId || senderDevice?.id !== expectedId) {
    throw new Error("Sync request result sender does not match the pending peer");
  }
}

function createDesktopDemoFailurePeer(input = {}) {
  const kind = input.targetKind === "tablet" || input.peerKind === "tablet" ? "tablet" : "phone";
  return {
    id: input.peerDeviceId ?? input.targetDeviceId ?? (kind === "tablet" ? "device_tablet_shell" : "device_mobile_shell"),
    name: input.peerDeviceName ?? input.targetDeviceName ?? (kind === "tablet" ? "LoginTo Tablet Shell" : "LoginTo Phone Shell"),
    kind,
    baseUrl: input.targetBaseUrl ?? (kind === "tablet" ? "http://127.0.0.1:4178" : "http://127.0.0.1:4177")
  };
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

export async function getDesktopShellSyncSummary(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  await appendRecordSyncChanges(runtime, input.requestedAt ?? shellNow, input.syncDeletionPath);
  await runtime.saveRuntimeState(input.requestedAt ?? shellNow);
  return {
    ok: true,
    device: runtime.localDevice,
    requestedAt: input.requestedAt ?? shellNow,
    summary: runtime.syncSession.getLocalSummary(),
    records: await summarizeDesktopRecordsWithTombstones(runtime, input.syncDeletionPath)
  };
}

export async function applyDesktopShellReminderAction(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const dueNotifications = await runtime.collectDueReminderNotifications(shellNow);
  const runtimeState = runtime.reminderNotifications.snapshot("2026-12-20T09:00:30.000Z");
  const alertId = input.alertId
    ?? dueNotifications[0]?.alertId
    ?? runtimeState.deliveries[0]?.alertId;

  if (!alertId) {
    throw new Error("No reminder notification is available to update");
  }

  const action = input.action ?? "complete";
  if (action === "complete" || action === "done") {
    await runtime.completeReminderNotification(alertId, input.at ?? "2026-12-20T09:05:00.000Z");
  } else if (action === "snooze") {
    await runtime.snoozeReminderNotification(
      alertId,
      input.snoozedUntil ?? "2026-12-20T10:00:00.000Z",
      input.at ?? "2026-12-20T09:05:00.000Z"
    );
  } else if (action === "dismiss") {
    await runtime.dismissReminderNotification(alertId, input.at ?? "2026-12-20T09:05:00.000Z");
  } else if (action === "delivered") {
    await runtime.markReminderNotificationDelivered(alertId, input.at ?? "2026-12-20T09:05:00.000Z");
  } else {
    throw new Error(`Unsupported reminder action: ${action}`);
  }

  return createDesktopShellAppState(input);
}

export async function dispatchDesktopShellReminderNotifications(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const adapter = createDesktopReminderNotificationAdapter({
    dispatchLogPath: input.dispatchLogPath,
    mode: input.mode,
    now: () => input.dispatchedAt ?? shellNow
  });
  const dispatches = await runtime.deliverDueTerminalReminderNotifications(
    adapter,
    input.dispatchedAt ?? shellNow
  );
  const dispatchLog = await readDesktopReminderNotificationDispatchLog(input);
  return {
    ok: true,
    dispatchedAt: input.dispatchedAt ?? shellNow,
    dispatches,
    dispatchLogPath: input.dispatchLogPath ?? getDesktopReminderNotificationDispatchLogPath(),
    dispatchLog: dispatchLog.slice(-10),
    appState: await createDesktopShellAppState(input)
  };
}

export async function createDesktopShellRecord(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const index = runtime.session.getRecords().filter((record) => record.title.startsWith("新增会员")).length + 1;
  const title = input.title?.trim() || `新增会员 ${index}`;
  const record = await runtime.addRecord({
    type: input.type ?? "membership",
    title,
    values: input.values ?? {
      member_name: title,
      member_id: `LOCAL-${String(index).padStart(4, "0")}`,
      expires_at: "2027-01-31T00:00:00.000Z",
      service_phone: "400-000-0000",
      notes: "通过桌面壳新增 API 写入的本地加密记录。"
    },
    reminderDrafts: input.reminderDrafts ?? [
      {
        dueAt: "2027-01-31T09:00:00.000Z",
        message: `${title} 即将到期`,
        daysBefore: 7
      }
    ]
  });
  if (input.attachment) {
    runtime.session.addAttachment(record.id, vault.createAttachmentRef({
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
    await runtime.session.save();
  }
  return createDesktopShellAppState(input);
}

export async function updateDesktopShellRecord(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const uiRecords = createUiRecordsFromRuntime(runtime.session.getRecords());
  const record = findUiRecord(uiRecords, input);
  if (!record?.recordId) {
    throw new Error("Record is not available for update");
  }
  const patch = {};
  if (input.title?.trim()) {
    patch.title = input.title.trim();
  }
  if (Object.keys(patch).length > 0) {
    await runtime.updateRecordMetadata(record.recordId, patch);
  }
  if (input.notes !== undefined) {
    const vaultRecord = runtime.session.getRecords().find((item) => item.id === record.recordId);
    if (vaultRecord?.fields.some((field) => field.key === "notes")) {
      await runtime.updateRecordFields(record.recordId, [
        {
          key: "notes",
          value: String(input.notes ?? "")
        }
      ]);
    }
  }
  return createDesktopShellAppState({
    ...input,
    selectedRecordId: record.recordId
  });
}

export async function deleteDesktopShellRecord(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const uiRecords = createUiRecordsFromRuntime(runtime.session.getRecords());
  const record = findUiRecord(uiRecords, input);
  if (!record?.recordId) {
    throw new Error("Record is not available for delete");
  }
  const vaultRecord = runtime.session.getRecords().find((item) => item.id === record.recordId);
  if (vaultRecord) {
    await appendDeletedRecordTombstone(
      toSafeRecordSummary(vaultRecord),
      input.deletedAt ?? shellNow,
      getRuntimeVaultId(runtime),
      input.syncDeletionPath
    );
  }
  await runtime.deleteRecord(record.recordId);
  const appState = await createDesktopShellAppState({
    ...input,
    selectedRecordId: undefined
  });
  return {
    ...appState,
    ok: true,
    deletedRecordId: record.recordId,
    appState
  };
}

export async function removeDesktopShellAttachment(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const uiRecords = createUiRecordsFromRuntime(runtime.session.getRecords());
  const record = findUiRecord(uiRecords, input);
  const attachmentId = String(input.attachmentId ?? "").trim();
  if (!record?.recordId || !attachmentId) {
    throw new Error("Record attachment is not available for removal");
  }
  const updatedRecord = await runtime.removeAttachment(record.recordId, attachmentId);
  return {
    ok: true,
    record: {
      id: updatedRecord.id,
      title: updatedRecord.title,
      attachments: updatedRecord.attachments.length
    },
    removedAttachmentId: attachmentId,
    appState: await createDesktopShellAppState({
      ...input,
      selectedRecordId: updatedRecord.id
    })
  };
}

export async function revealDesktopShellFields(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const at = input.at ?? shellNow;
  const action = input.action ?? "reveal";
  runtime.unlock(at);
  if (input.secondUnlock === true) {
    runtime.unlockCriticalFields(at);
  }

  const vaultRecords = runtime.session.getRecords();
  const uiRecords = createUiRecordsFromRuntime(vaultRecords);
  const record = findUiRecord(uiRecords, input);
  if (!record) {
    throw new Error("Record is not available for field reveal");
  }
  const vaultRecord = vaultRecords.find((item) => item.id === record.recordId);
  if (!vaultRecord) {
    throw new Error("Vault record is not available for field reveal");
  }

  const requestedLabel = input.fieldLabel?.trim();
  const secretFields = record.fields.filter((field) => {
    if (!field.secret) {
      return false;
    }
    return requestedLabel ? field.label === requestedLabel : true;
  });
  if (secretFields.length === 0) {
    throw new Error("No sensitive fields matched the reveal request");
  }

  const fields = [];
  const denied = [];
  for (const [fieldIndex, field] of secretFields.entries()) {
    const sensitivity = field.sensitivity ?? "secret";
    const decision = runtime.canRevealField(sensitivity, at);
    if (!decision.canReveal) {
      denied.push({
        label: field.label,
        sensitivity,
        reason: decision.reason
      });
      continue;
    }

    const fieldKey = `${record.recordId}:${field.label}`;
    const copyPlan = action === "copy" ? runtime.planClipboardClear(fieldKey, at) : undefined;
    const vaultField = findVaultFieldByUiLabel(vaultRecord, field.label)
      ?? vaultRecord.fields.filter((item) => item.sensitivity === "secret" || item.sensitivity === "critical")[fieldIndex];
    if (!vaultField) {
      throw new Error(`Encrypted field is not available for reveal: ${field.label}`);
    }
    fields.push({
      label: field.label,
      value: await runtime.revealFieldValue({
        recordId: vaultRecord.id,
        fieldKey: vaultField.key,
        sensitivity: vaultField.sensitivity,
        valueCipher: vaultField.valueCipher
      }),
      sensitivity,
      copyClearAt: copyPlan?.clearAt
    });
  }

  return {
    ok: denied.length === 0,
    action,
    recordId: record.id,
    vaultRecordId: record.recordId,
    fields,
    denied,
    security: runtime.security.snapshot(at)
  };
}

function findVaultFieldByUiLabel(record, label) {
  const template = vault.getRecordTemplate(record.type);
  const fieldKey = template.fields.find((field) => field.label === label)?.key;
  return record.fields.find((field) => field.key === fieldKey);
}

export async function createDesktopShellPairingPreview(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  return createDesktopShellPairingPreviewFromRuntime(runtime, input);
}

export async function confirmDesktopShellPairing(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
  const at = input.at ?? shellNow;
  runtime.unlock(at);
  const session = runtime.beginPairing({
    sessionId: input.localSessionId ?? input.sessionId,
    localEndpoint: input.localEndpoint ?? "http://127.0.0.1:43110",
    ttlSeconds: input.ttlSeconds ?? 300
  });
  const remotePayload = input.remotePairingPayload;
  if (!remotePayload) {
    return {
      ok: false,
      status: session.status,
      reason: "remote-pairing-payload-required",
      localPairingPayload: session.localPayload
    };
  }
  requireLocalPeerBaseUrl(remotePayload.localEndpoint, "pairing peer");
  const verification = session.receiveRemotePayload(remotePayload);
  if (!input.confirmedCode) {
    return {
      ok: false,
      status: session.status,
      verification,
      reason: "pairing-code-required",
      localPairingPayload: session.localPayload,
      remotePairingPayload: remotePayload
    };
  }
  if (input.confirmedCode !== verification.sixDigitCode) {
    return {
      ok: false,
      status: session.status,
      verification,
      reason: "pairing-code-mismatch"
    };
  }
  session.markVerified(at);
  const trustedDevice = session.confirmTrustedDevice(runtime.syncSession.trustedDevices, at);
  await runtime.saveRuntimeState(at);
  return {
    ok: true,
    status: session.status,
    verification,
    trustedDevice,
    trustedDevices: runtime.syncSession.trustedDevices.list().length,
    localPairingPayload: session.localPayload,
    remotePairingPayload: remotePayload
  };
}

export async function revokeDesktopShellTrustedDevice(input = {}) {
  const runtime = await createDesktopShellRuntime(input);
  await seedRuntimeIfEmpty(runtime);
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
  await runtime.saveRuntimeState(input.revokedAt ?? shellNow);
  await appendTrustedDeviceRevocation({
    id: ids.nextId("trusted_device_revocation"),
    revokedAt: input.revokedAt ?? shellNow,
    deviceId: device.id,
    deviceName: device.name,
    deviceKind: device.kind,
    publicKeyFingerprint: createDeviceKeyFingerprint(device.publicKeyBase64),
    confirmation: "device-name-confirmed"
  }, input.trustedDeviceRevocationPath);
  return {
    ok: true,
    revoked,
    revokedDeviceId: deviceId,
    revokedDeviceName: device.name,
    appState: await createDesktopShellAppState(input)
  };
}

async function createDesktopShellRuntime(input) {
  const vaultPath = input.vaultPath ?? getVaultPath();
  const runtimeStatePath = input.runtimeStatePath ?? getRuntimeStatePath();
  const storageKind = input.storageKind ?? getStorageKind();
  const sqliteVaultPath = input.sqliteVaultPath ?? getSqliteVaultPath(vaultPath);
  await mkdir(dirname(vaultPath), { recursive: true });
  await mkdir(dirname(runtimeStatePath), { recursive: true });
  const localDevice = await loadLocalDeviceIdentity({
    path: input.deviceIdentityPath ?? getDeviceIdentityPath(),
    name: "LoginTo Desktop Shell",
    kind: "desktop",
    legacyPublicKeyBase64: "desktop-shell-public-key"
  });
  const createRuntime = () => desktopRuntime.createDesktopRuntime({
    vaultPath,
    storageKind,
    sqliteVaultPath,
    runtimeStatePath,
    password,
    saltBase64,
    vaultName: "LoginTo Desktop Shell Vault",
    localDevice,
    kdfIterations: 20_000,
    now,
    ids
  });

  try {
    return await createRuntime();
  } catch (error) {
    if (!isRecoverablePreviewStateError(error) || input.runtimeStatePath) {
      throw error;
    }
    await archiveCorruptPreviewFile(runtimeStatePath);
    return createRuntime();
  }
}

function isRecoverablePreviewStateError(error) {
  return error instanceof SyntaxError || String(error?.message ?? "").includes("not valid JSON");
}

async function archiveCorruptPreviewFile(path) {
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  try {
    await rename(path, `${path}.corrupt-${suffix}`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function createDesktopShellPairingPreviewFromRuntime(runtime, input = {}) {
  const session = runtime.beginPairing({
    localEndpoint: input.localEndpoint ?? "http://127.0.0.1:43110",
    ttlSeconds: input.ttlSeconds ?? 300
  });
  const payload = session.localPayload;
  const payloadText = JSON.stringify(payload);
  const matrix = sync.encodePairingPayloadMatrix(payload);
  const qr = sync.encodePairingPayloadQr(payload);
  return {
    sessionId: payload.sessionId,
    protocol: payload.protocol,
    localEndpoint: payload.localEndpoint,
    expiresAt: payload.expiresAt,
    sixDigitCode: createPreviewVerificationCode(payloadText),
    pairingPayload: payload,
    qrFormat: qr.format,
    qrStandard: qr.standard,
    qrErrorCorrectionLevel: qr.errorCorrectionLevel,
    qrSize: qr.size,
    qrPayloadText: qr.payloadText,
    qrCells: qr.cells,
    qrSvg: qr.svg,
    legacyMatrixFormat: matrix.format,
    legacyMatrixSize: matrix.size,
    legacyMatrixPayloadText: matrix.payloadText,
    legacyMatrixCells: matrix.cells
  };
}

async function seedRuntimeIfEmpty(runtime) {
  const existingTitles = new Set(runtime.session.getRecords().map((record) => record.title));
  const deletedTitles = new Set((await loadDeletedRecordTombstones(getRuntimeVaultId(runtime))).map((record) => record.title));
  for (const seed of seedRecords) {
    if (!existingTitles.has(seed.title) && !deletedTitles.has(seed.title)) {
      await runtime.addRecord({
        type: seed.type,
        title: seed.title,
        values: seed.values,
        reminderDrafts: seed.reminderDrafts ?? []
      });
    }
  }
}

function createUiRecordsFromRuntime(records) {
  return records
    .map((record) => {
      const seed = seedRecords.find((item) => item.title === record.title);
      if (seed) {
        return {
          ...seed.ui,
          title: record.title,
          recordId: record.id,
          attachments: createUiAttachmentSummaries(record),
          attachmentCount: record.attachments.length,
          encryptedFields: record.fields.length,
          reminders: record.reminders.length
        };
      }
      const fallback = fallbackTypeUi[record.type] ?? fallbackTypeUi.custom;
      return {
        id: record.id,
        type: fallback.type,
        subtitle: `${recordTypeLabel(record.type)} · 本地新增 · 已加密保存`,
        icon: fallback.icon,
        badge: fallback.badge,
        badgeTone: fallback.badgeTone,
        title: record.title,
        recordId: record.id,
        fields: createFallbackFields(record),
        attachments: createUiAttachmentSummaries(record),
        attachmentCount: record.attachments.length,
        encryptedFields: record.fields.length,
        reminders: record.reminders.length
      };
    })
    .sort((a, b) => sortUiRecord(a.id) - sortUiRecord(b.id));
}

function createUiAttachmentSummaries(record) {
  return record.attachments.map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    source: attachment.source,
    encryptedBlobPath: attachment.encryptedBlobPath,
    encryptedSize: attachment.encryptedSize,
    encrypted: true
  }));
}

function createPreviewVerificationCode(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String((hash >>> 0) % 1_000_000).padStart(6, "0");
}

function selectReminderModalState(dueAlerts, dueNotifications, deliveries) {
  const pendingDelivery = dueNotifications[0];
  if (pendingDelivery) {
    const popup = createReminderPopupCopy({
      recordTitle: pendingDelivery.recordTitle,
      title: pendingDelivery.title,
      body: pendingDelivery.message,
      dueAt: pendingDelivery.dueAt
    });
    return {
      alertId: pendingDelivery.alertId,
      popupTitle: popup.title,
      recordTitle: pendingDelivery.recordTitle,
      popupBody: popup.body,
      status: pendingDelivery.status
    };
  }

  const latestDelivery = deliveries[0];
  if (latestDelivery) {
    const popup = createReminderPopupCopy({
      recordTitle: latestDelivery.recordTitle,
      title: latestDelivery.title,
      body: latestDelivery.message,
      dueAt: latestDelivery.dueAt
    });
    return {
      alertId: latestDelivery.alertId,
      popupTitle: popup.title,
      recordTitle: latestDelivery.recordTitle,
      popupBody: popup.body,
      status: latestDelivery.status
    };
  }

  const alert = dueAlerts[0];
  const popup = createReminderPopupCopy(alert ?? {
    recordTitle: "Airport Lounge VIP",
    title: "会员到期提醒",
    body: "会员将在 2026-12-31 到期。",
    dueAt: "2026-12-31T00:00:00.000Z"
  });
  return {
    alertId: undefined,
    popupTitle: popup.title,
    recordTitle: alert?.recordTitle ?? "Airport Lounge VIP",
    popupBody: popup.body,
    status: "none"
  };
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

function findUiRecord(uiRecords, input) {
  return uiRecords.find((record) => {
    return record.id === input.recordId
      || record.id === input.uiRecordId
      || record.recordId === input.recordId
      || record.title === input.title;
  }) ?? uiRecords[0];
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

function selectUiRecordId(uiRecords, selectedRecordId) {
  if (selectedRecordId) {
    const selected = uiRecords.find((record) => record.id === selectedRecordId || record.recordId === selectedRecordId);
    if (selected) {
      return selected.id;
    }
  }
  return uiRecords.some((record) => record.id === "github") ? "github" : uiRecords[0]?.id;
}

function sortUiRecord(id) {
  const order = ["github", "lounge", "card", "passport"].indexOf(id);
  return order >= 0 ? order : 100;
}

function createFallbackFields(record) {
  return [
    { label: "标题", value: record.title },
    { label: "类型", value: recordTypeLabel(record.type) },
    { label: "加密字段", value: `${record.fields.length} 个字段已加密` },
    { label: "提醒", value: `${record.reminders.length} 条提醒` }
  ];
}

function recordTypeLabel(type) {
  return {
    account: "网站账号",
    bank_card: "银行卡",
    membership: "会员信息",
    identity_document: "证件信息",
    secret_key: "密钥/API",
    custom: "自定义记录"
  }[type] ?? type;
}

function getVaultPath() {
  return process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH || defaultVaultPath;
}

function getRuntimeStatePath() {
  return process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH || defaultRuntimeStatePath;
}

function getStorageKind() {
  return process.env.LOGINTO_DESKTOP_STORAGE_KIND === "sqlite" ? "sqlite" : "file";
}

function getSqliteVaultPath(vaultPath = getVaultPath()) {
  return process.env.LOGINTO_DESKTOP_SQLITE_VAULT_PATH || `${vaultPath}.sqlite`;
}

function getDeviceIdentityPath() {
  return process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH || defaultDeviceIdentityPath;
}

function getBackupPackagePath() {
  return process.env.LOGINTO_DESKTOP_BACKUP_PACKAGE_PATH || defaultBackupPackagePath;
}

function getBackupVerifyVaultPath() {
  return process.env.LOGINTO_DESKTOP_BACKUP_VERIFY_VAULT_PATH || defaultBackupVerifyVaultPath;
}

function getBackupVerifySqliteVaultPath(vaultPath = getBackupVerifyVaultPath()) {
  return process.env.LOGINTO_DESKTOP_BACKUP_VERIFY_SQLITE_VAULT_PATH || defaultBackupVerifySqliteVaultPath || `${vaultPath}.sqlite`;
}

function getBackupVerifyRuntimeStatePath() {
  return process.env.LOGINTO_DESKTOP_BACKUP_VERIFY_RUNTIME_STATE_PATH || defaultBackupVerifyRuntimeStatePath;
}

async function normalizeDesktopSyncTarget(input) {
  const kind = input.targetKind === "tablet" ? "tablet" : "phone";
  const baseUrl = kind === "tablet"
    ? input.targetBaseUrl ?? process.env.LOGINTO_TABLET_SYNC_BASE_URL ?? "http://127.0.0.1:4178"
    : input.targetBaseUrl ?? process.env.LOGINTO_MOBILE_SYNC_BASE_URL ?? "http://127.0.0.1:4177";
  const localBaseUrl = requireLocalPeerBaseUrl(baseUrl, `${kind} sync target`);
  const discovered = await discoverTerminalDevice(localBaseUrl, kind);
  if (kind === "tablet") {
    return {
      kind,
      baseUrl: localBaseUrl,
      device: {
        id: input.targetDeviceId ?? discovered?.id ?? "device_tablet_shell",
        name: input.targetDeviceName ?? discovered?.name ?? "LoginTo Tablet Shell",
        kind: "tablet",
        publicKeyBase64: requireDiscoveredPublicKey(input.targetPublicKeyBase64 ?? discovered?.publicKeyBase64, "tablet")
      }
    };
  }
  return {
    kind,
    baseUrl: localBaseUrl,
    device: {
      id: input.targetDeviceId ?? discovered?.id ?? "device_mobile_shell",
      name: input.targetDeviceName ?? discovered?.name ?? "LoginTo Phone Shell",
      kind: "phone",
      publicKeyBase64: requireDiscoveredPublicKey(input.targetPublicKeyBase64 ?? discovered?.publicKeyBase64, "phone")
    }
  };
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

async function createDesktopShellNearFieldDiscoveryFromRuntime(runtime, input = {}) {
  const scannedAt = input.scannedAt ?? shellNow;
  const trustedDevices = runtime.syncSession.trustedDevices.list();
  const targets = input.targets ?? [
    {
      kind: "phone",
      label: "手机",
      baseUrl: process.env.LOGINTO_MOBILE_SYNC_BASE_URL ?? "http://127.0.0.1:4177",
      fallbackDevice: {
        id: "device_mobile_shell",
        name: "LoginTo Phone Shell",
        kind: "phone",
        publicKeyBase64: "unknown-mobile-key"
      }
    },
    {
      kind: "tablet",
      label: "平板",
      baseUrl: process.env.LOGINTO_TABLET_SYNC_BASE_URL ?? "http://127.0.0.1:4178",
      fallbackDevice: {
        id: "device_tablet_shell",
        name: "LoginTo Tablet Shell",
        kind: "tablet",
        publicKeyBase64: "unknown-tablet-key"
      }
    }
  ];
  const targetDescriptors = Array.isArray(input.hosts) && Array.isArray(input.ports)
    ? [
        ...sync.createNearFieldEndpointProbeTargets({
          hosts: input.hosts,
          ports: input.ports,
          transport: "local-network",
          expectedProduct: "LoginTo mobile shell",
          expectedKind: "phone",
          includeFallbackCandidate: false,
          maxTargets: input.maxTargets ?? 24
        }),
        ...sync.createNearFieldEndpointProbeTargets({
          hosts: input.hosts,
          ports: input.ports,
          transport: "local-network",
          expectedProduct: "LoginTo tablet shell",
          expectedKind: "tablet",
          includeFallbackCandidate: false,
          maxTargets: input.maxTargets ?? 24
        })
      ]
    : input.useLanHostScan
      ? createDesktopLanProbeTargets(input)
      : targets.map((target) => ({
      endpoint: target.baseUrl ?? target.endpoint,
      transport: target.transport ?? "local-network",
      expectedProduct: target.expectedProduct ?? (target.kind === "tablet" ? "LoginTo tablet shell" : "LoginTo mobile shell"),
      expectedKind: target.kind,
      fallbackDevice: target.fallbackDevice,
      includeFallbackCandidate: target.includeFallbackCandidate ?? true
    }));
  const probed = await sync.createNearFieldDiscoverySnapshotFromProbeTargets({
    localDeviceId: runtime.localDevice.id,
    scannedAt,
    trustedDevices,
    targets: targetDescriptors,
    timeoutMs: input.timeoutMs ?? 1_000
  });
  const candidates = probed.candidates.map((candidate) => {
    const lastReceipt = (input.syncReceipts ?? [])
      .filter((receipt) => receipt.peerDeviceId === candidate.device.id || receipt.senderDeviceId === candidate.device.id || receipt.receiverDeviceId === candidate.device.id)
      .at(-1);
    return {
      ...candidate,
      lastReceiptAt: lastReceipt?.syncedAt ?? lastReceipt?.receivedAt ?? candidate.lastReceiptAt
    };
  });
  const localNetworkCandidates = desktopNetwork.getDesktopLocalNetworkBaseUrlCandidates(43110);
  const transportPlan = sync.createNearFieldTransportPlan({
    availableTransports: ["local-network"],
    recommendedTransport: "local-network"
  });
  return {
    ...sync.createNearFieldDiscoverySnapshot({
      localDeviceId: runtime.localDevice.id,
      scannedAt,
      candidates
    }),
    probes: probed.probes,
    advertisedEndpoints: localNetworkCandidates,
    transportPlan,
    channels: [
      { id: "local-network", label: "局域网", status: "available" },
      { id: "hotspot", label: "手机热点", status: "planned" },
      { id: "bluetooth", label: "蓝牙", status: "planned" }
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
      targetKind: receipt.targetKind,
      targetBaseUrl: receipt.targetBaseUrl,
      targetDeviceId: receipt.peerDeviceId ?? receipt.receiverDeviceId,
      targetDeviceName: peerName
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

function createDesktopLanProbeTargets(input = {}) {
  const scanTargets = desktopNetwork.getDesktopLocalNetworkEndpointScanTargets({
    ports: input.ports ?? [4177, 4178],
    neighborRadius: input.neighborRadius ?? 1,
    maxHosts: input.maxHosts ?? 8,
    includeLoopback: true
  });
  return [
    ...sync.createNearFieldEndpointProbeTargets({
      hosts: scanTargets.hosts,
      ports: scanTargets.ports,
      transport: "local-network",
      expectedProduct: "LoginTo mobile shell",
      expectedKind: "phone",
      includeFallbackCandidate: false,
      maxTargets: input.maxTargets ?? 24
    }),
    ...sync.createNearFieldEndpointProbeTargets({
      hosts: scanTargets.hosts,
      ports: scanTargets.ports,
      transport: "local-network",
      expectedProduct: "LoginTo tablet shell",
      expectedKind: "tablet",
      includeFallbackCandidate: false,
      maxTargets: input.maxTargets ?? 24
    })
  ];
}

async function discoverTerminalDevice(baseUrl, kind) {
  const summary = await fetchRemoteSyncSummary({ baseUrl });
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
    const state = await response.json();
    const localDevice = state.syncPanel?.localDevice;
    if (localDevice?.id) {
      return localDevice;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function getSyncReceiptPath(path) {
  return path || process.env.LOGINTO_TERMINAL_SYNC_RECEIPTS_PATH || defaultSyncReceiptPath;
}

function getSyncConfirmationPath(path) {
  return path || process.env.LOGINTO_DESKTOP_SYNC_CONFIRMATIONS_PATH || defaultSyncConfirmationPath;
}

function getTrustedDeviceRevocationPath(path) {
  return path || process.env.LOGINTO_DESKTOP_TRUSTED_DEVICE_REVOCATIONS_PATH || defaultTrustedDeviceRevocationPath;
}

function getSyncDeletionPath(path) {
  return path || process.env.LOGINTO_DESKTOP_SYNC_DELETIONS_PATH || `${getVaultPath()}.sync-deletions.json`;
}

async function loadSyncReceipts(path) {
  try {
    const json = await readFile(getSyncReceiptPath(path), "utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveSyncReceipts(receipts, path) {
  const receiptPath = getSyncReceiptPath(path);
  await writeJsonFileAtomically(receiptPath, { receipts });
}

async function loadTrustedDeviceRevocations(path) {
  try {
    const json = await readFile(getTrustedDeviceRevocationPath(path), "utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.revocations) ? parsed.revocations : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function appendTrustedDeviceRevocation(event, path) {
  const revocations = await loadTrustedDeviceRevocations(path);
  revocations.push(event);
  const revocationPath = getTrustedDeviceRevocationPath(path);
  await writeJsonFileAtomically(revocationPath, { revocations: revocations.slice(-50) });
}

async function loadDeletedRecordTombstones(vaultId, path) {
  try {
    const resolvedVaultId = vaultId ?? await loadVaultIdFromSnapshotFile();
    const parsed = JSON.parse(await readFile(getSyncDeletionPath(path), "utf8"));
    return Array.isArray(parsed.deletedRecords)
      ? parsed.deletedRecords.filter((record) => record.vaultId === resolvedVaultId)
      : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function loadVaultIdFromSnapshotFile() {
  const vaultSnapshot = JSON.parse(await readFile(getVaultPath(), "utf8"));
  return vaultSnapshot.manifest?.vaultId;
}

async function saveDeletedRecordTombstones(deletedRecords, path) {
  const deletionPath = getSyncDeletionPath(path);
  await writeJsonFileAtomically(deletionPath, { deletedRecords });
}

async function appendDeletedRecordTombstone(record, deletedAt, vaultId, path) {
  const resolvedVaultId = vaultId ?? await loadVaultIdFromSnapshotFile();
  const deletedRecords = await loadDeletedRecordTombstones(resolvedVaultId, path);
  const tombstone = {
    ...record,
    vaultId: resolvedVaultId,
    deleted: true,
    archived: true,
    deletedAt,
    updatedAt: deletedAt
  };
  const nextRecords = [
    ...deletedRecords.filter((item) => item.id !== tombstone.id),
    tombstone
  ];
  await saveDeletedRecordTombstones(nextRecords.slice(-100), path);
  return tombstone;
}

async function appendRecordSyncChanges(runtime, at, syncDeletionPath) {
  let lamport = runtime.syncSession.changeLog.list().length;
  for (const record of runtime.session.getRecords()) {
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
  for (const tombstone of await loadDeletedRecordTombstones(getRuntimeVaultId(runtime), syncDeletionPath)) {
    lamport += 1;
    runtime.appendLocalSyncChange(sync.createSyncChange({
      entity: "record",
      entityId: tombstone.id,
      operation: "delete",
      deviceId: runtime.localDevice.id,
      lamport,
      payloadCipher: createRecordDeletePayload(tombstone),
      createdAt: tombstone.deletedAt ?? at,
      ids
    }));
  }
}

async function fetchRemoteSyncSummary(target) {
  try {
    const response = await fetch(`${target.baseUrl}/api/sync/summary`, {
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
      deliveredAt: shellNow
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message ?? String(error),
      deliveredAt: shellNow
    };
  }
}

async function sendSyncRequestResultToPeer(baseUrl, payload) {
  if (!baseUrl) {
    return { ok: false, error: "missing peer base url", deliveredAt: shellNow };
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
      deliveredAt: shellNow
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message ?? String(error),
      deliveredAt: shellNow
    };
  }
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

function createRecordSyncPayload(record) {
  return `record-snapshot-v1:${Buffer.from(JSON.stringify({ record })).toString("base64")}`;
}

function createRecordDeletePayload(tombstone) {
  return `record-delete-v1:${Buffer.from(JSON.stringify({ tombstone })).toString("base64")}`;
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

function applyRecordSyncPayloadsToDesktopVault(runtime, exchangePackage, report, decisions) {
  const changesById = new Map(exchangePackage.changes.map((change) => [change.id, change]));
  for (const change of exchangePackage.changes) {
    if (change.operation === "delete") {
      const deletedRecord = parseRecordDeletePayload(change);
      if (deletedRecord) {
        runtime.session.repository.deleteRecord(deletedRecord.id);
      }
    }
  }
  for (const change of report.appliedChanges) {
    const deletedRecord = parseRecordDeletePayload(change);
    if (deletedRecord) {
      runtime.session.repository.deleteRecord(deletedRecord.id);
      continue;
    }
    const record = parseRecordSyncPayload(change);
    if (record) {
      upsertDesktopVaultRecord(runtime, record);
    }
  }
  for (const conflict of report.resolvedConflicts) {
    if (conflict.resolution !== "manual-merge") {
      continue;
    }
    const remoteRecord = parseRecordSyncPayload(changesById.get(conflict.remoteChangeId));
    const localRecord = runtime.session.repository.getRecord(conflict.entityId);
    if (!remoteRecord || !localRecord) {
      continue;
    }
    const decision = findRecordConflictDecision(decisions, conflict);
    runtime.session.repository.replaceRecord(mergeRecordFieldsByDecision(localRecord, remoteRecord, decision?.manualMerge));
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

function upsertDesktopVaultRecord(runtime, record) {
  if (runtime.session.repository.getRecord(record.id)) {
    runtime.session.repository.replaceRecord(record);
  } else {
    runtime.session.repository.insertRecord(record);
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

function summarizeDesktopRecords(runtime) {
  return runtime.session.getRecords().map(toSafeRecordSummary);
}

async function summarizeDesktopRecordsWithTombstones(runtime, syncDeletionPath) {
  return [
    ...summarizeDesktopRecords(runtime),
    ...(await loadDeletedRecordTombstones(getRuntimeVaultId(runtime), syncDeletionPath)).map((record) => ({
      ...record,
      deleted: true,
      archived: true
    }))
  ];
}

function getRuntimeVaultId(runtime) {
  return runtime.session.repository.getManifest().vaultId;
}

function toSafeRecordSummary(record) {
  return {
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
      recordsToSend.push({ operation: record.deleted ? "delete" : record.archived ? "archive" : "create", record });
      continue;
    }
    if (record.deleted) {
      recordsToSend.push({ operation: "delete", record });
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
      { value: "ignore-remote", label: "忽略传入" }
    ]
  };
}

async function requireSyncConfirmation(input) {
  if (!input.confirmationId) {
    throw new Error("Sync confirmation is required before exchanging packages");
  }
  const confirmations = await loadSyncConfirmations(input.path);
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

async function markSyncConfirmationConfirmed(confirmationId, confirmedAt, path) {
  const confirmations = await loadSyncConfirmations(path);
  const updated = confirmations.map((item) => item.id === confirmationId
    ? { ...item, status: "confirmed", confirmedAt }
    : item);
  await saveSyncConfirmations(updated, path);
}

async function markSyncConfirmationFailed(confirmationId, failedAt, path) {
  const confirmations = await loadSyncConfirmations(path);
  const updated = confirmations.map((item) => item.id === confirmationId
    ? { ...item, status: "failed", failedAt }
    : item);
  await saveSyncConfirmations(updated, path);
}

async function encryptShellSyncExchangePackage(exchangePackage, localDevice, peerDevice) {
  const adapter = crypto.createWebCryptoAesGcmAdapter();
  const key = await deriveShellSyncPackageKey(adapter, exchangePackage, localDevice, peerDevice);
  return sync.encryptSyncExchangePackage({ exchangePackage, adapter, key });
}

async function decryptShellSyncExchangePackage(encryptedPackage, localDevice, peerDevice) {
  const adapter = crypto.createWebCryptoAesGcmAdapter();
  const key = await deriveShellSyncPackageKey(adapter, encryptedPackage, localDevice, peerDevice);
  return sync.decryptSyncExchangePackage({ encryptedPackage, adapter, key });
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

async function loadSyncConfirmations(path) {
  try {
    const json = await readFile(getSyncConfirmationPath(path), "utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.confirmations) ? parsed.confirmations : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveSyncConfirmations(confirmations, path) {
  const confirmationPath = getSyncConfirmationPath(path);
  await writeJsonFileAtomically(confirmationPath, { confirmations });
}

function addSeconds(iso, seconds) {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
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
