import {
  DEFAULT_KDF_PARAMS,
  DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  VaultSecuritySession,
  createCryptoFieldEncryptor,
  createCryptoPackageDecryptor,
  createCryptoPackageEncryptor,
  createWebCryptoAesGcmAdapter,
  decryptCryptoFieldValue,
  type ClipboardClearPlan,
  type CryptoAdapter,
  type FieldRevealDecision,
  type KdfParams
} from "../../../packages/crypto-core/src/index.ts";
import {
  InMemoryVaultRepository,
  ReminderNotificationCenter,
  createVaultPackageAsync,
  getDueReminderAlerts,
  getUpcomingReminderAlerts,
  parseVaultPackage,
  restoreSnapshotFromVaultPackageAsync,
  serializeVaultPackage,
  deliverTerminalReminderNotifications,
  type Clock,
  type FieldSensitivity,
  type FieldUpdate,
  type IdFactory,
  type ReminderAlert,
  type ReminderNotificationDelivery,
  type TerminalNotificationAdapter,
  type TerminalReminderNotificationDispatch,
  type VaultPackage,
  type VaultRecord,
  type VaultStorageAdapter
} from "../../../packages/vault-core/src/index.ts";
import {
  NearFieldSyncSession,
  type DeviceIdentity,
  type FaceToFacePairingSession,
  type SyncChange
} from "../../../packages/sync-core/src/index.ts";
import { DesktopFileVaultStorageAdapter } from "./file-vault-storage.ts";
import { DesktopSqliteVaultStorageAdapter } from "./sqlite-vault-storage.ts";
import {
  DesktopLocalNetworkTransportAdapter,
  startDesktopLocalNetworkEndpoint,
  type DesktopLocalNetworkEndpointServer,
  type StartDesktopLocalNetworkEndpointInput
} from "./local-network-transport.ts";
import { createDesktopPairingSession } from "./pairing-workflow.ts";
import {
  DesktopFileRuntimeStateStorageAdapter,
  createDefaultDesktopRuntimeStatePath,
  createDesktopRuntimeStateSnapshot,
  type DesktopRuntimeStateStorageAdapter
} from "./runtime-state-storage.ts";
import { DesktopVaultSession, type AddRecordInput } from "./vault-session.ts";

export interface CreateDesktopRuntimeInput {
  vaultPath: string;
  password: string;
  vaultName: string;
  localDevice: DeviceIdentity & { kind: "desktop" };
  storageKind?: "file" | "sqlite";
  sqliteVaultPath?: string;
  runtimeStatePath?: string;
  saltBase64?: string;
  kdfIterations?: number;
  cryptoAdapter?: CryptoAdapter;
  cryptoKdfParams?: Omit<KdfParams, "saltBase64">;
  autoLockSeconds?: number;
  secondUnlockSeconds?: number;
  copyClearSeconds?: number;
  now?: Clock;
  ids?: IdFactory;
}

export interface DesktopRuntimeCryptoState {
  kdfParams: KdfParams;
  fieldAadPrefix: string;
}

export interface BeginDesktopPairingInput {
  sessionId?: string;
  localEndpoint?: string;
  ttlSeconds?: number;
}

export interface DesktopRuntimeSnapshot {
  vaultName: string;
  deviceId: string;
  records: number;
  trustedDevices: number;
  dueReminders: number;
  lockState: "locked" | "unlocked";
}

export class DesktopRuntime {
  readonly localDevice: DeviceIdentity & { kind: "desktop" };
  readonly session: DesktopVaultSession;
  readonly syncSession: NearFieldSyncSession;
  readonly storage: VaultStorageAdapter;
  readonly runtimeStateStorage: DesktopRuntimeStateStorageAdapter;
  readonly cryptoState: DesktopRuntimeCryptoState;
  readonly security: VaultSecuritySession;
  readonly reminderNotifications: ReminderNotificationCenter;
  readonly transport = new DesktopLocalNetworkTransportAdapter();
  #adapter: CryptoAdapter;
  #key: Uint8Array;
  #now?: Clock;
  #ids?: IdFactory;

  constructor(input: {
    localDevice: DeviceIdentity & { kind: "desktop" };
    session: DesktopVaultSession;
    syncSession: NearFieldSyncSession;
    storage: VaultStorageAdapter;
    runtimeStateStorage: DesktopRuntimeStateStorageAdapter;
    cryptoState: DesktopRuntimeCryptoState;
    security: VaultSecuritySession;
    reminderNotifications: ReminderNotificationCenter;
    adapter: CryptoAdapter;
    key: Uint8Array;
    now?: Clock;
    ids?: IdFactory;
  }) {
    this.localDevice = input.localDevice;
    this.session = input.session;
    this.syncSession = input.syncSession;
    this.storage = input.storage;
    this.runtimeStateStorage = input.runtimeStateStorage;
    this.cryptoState = input.cryptoState;
    this.security = input.security;
    this.reminderNotifications = input.reminderNotifications;
    this.#adapter = input.adapter;
    this.#key = input.key;
    this.#now = input.now;
    this.#ids = input.ids;
  }

  async addRecord(input: AddRecordInput): Promise<VaultRecord> {
    this.requireUnlocked();
    const record = await this.session.addRecordAsync(input);
    await this.session.save();
    return record;
  }

  async updateRecordFields(recordId: string, updates: FieldUpdate[]): Promise<VaultRecord> {
    this.requireUnlocked();
    const record = await this.session.updateRecordFieldsAsync(recordId, updates);
    await this.session.save();
    return record;
  }

  async updateRecordMetadata(
    recordId: string,
    patch: Partial<Pick<VaultRecord, "title" | "categoryId" | "tagIds" | "favorite" | "archived">>
  ): Promise<VaultRecord> {
    this.requireUnlocked();
    const current = this.session.getRecords().find((record) => record.id === recordId);
    if (!current) {
      throw new Error(`Record does not exist: ${recordId}`);
    }
    const record = this.session.repository.replaceRecord({
      ...current,
      ...patch,
      title: patch.title?.trim() ?? current.title,
      tagIds: patch.tagIds ? [...patch.tagIds] : current.tagIds,
      version: current.version + 1,
      updatedAt: this.#now?.() ?? new Date().toISOString()
    });
    await this.session.save();
    return record;
  }

  async removeAttachment(recordId: string, attachmentId: string): Promise<VaultRecord> {
    this.requireUnlocked();
    const record = this.session.repository.removeAttachment(recordId, attachmentId);
    await this.session.save();
    return record;
  }

  async deleteRecord(recordId: string): Promise<boolean> {
    this.requireUnlocked();
    const deleted = this.session.repository.deleteRecord(recordId);
    await this.session.save();
    return deleted;
  }

  async exportEncryptedBackupPackage(): Promise<VaultPackage> {
    this.requireUnlocked();
    return createVaultPackageAsync({
      snapshot: this.session.repository.snapshot(),
      keyPurpose: "backup-package",
      encryptPayload: createCryptoPackageEncryptor({
        adapter: this.#adapter,
        key: this.#key
      }),
      now: this.#now,
      ids: this.#ids
    });
  }

  serializeEncryptedBackupPackage(vaultPackage: VaultPackage): string {
    return serializeVaultPackage(vaultPackage);
  }

  getDueReminderPopups(now = this.#now?.() ?? new Date().toISOString()): ReminderAlert[] {
    return getDueReminderAlerts(this.session.getRecords(), now);
  }

  getUpcomingReminderPopups(now = this.#now?.() ?? new Date().toISOString(), daysAhead = 30): ReminderAlert[] {
    return getUpcomingReminderAlerts(this.session.getRecords(), now, daysAhead);
  }

  async collectDueReminderNotifications(now = this.#now?.() ?? new Date().toISOString()): Promise<ReminderNotificationDelivery[]> {
    const deliveries = this.reminderNotifications.collectDue(this.session.getRecords(), now);
    await this.saveRuntimeState(now);
    return deliveries;
  }

  async deliverDueTerminalReminderNotifications(
    adapter: TerminalNotificationAdapter,
    now = this.#now?.() ?? new Date().toISOString()
  ): Promise<TerminalReminderNotificationDispatch[]> {
    const deliveries = this.reminderNotifications.collectDue(this.session.getRecords(), now);
    const dispatches = await deliverTerminalReminderNotifications({
      adapter,
      deliveries,
      now: () => now,
      onDelivered: (delivery, shown) => {
        this.reminderNotifications.markDelivered(delivery.alertId, shown.shownAt);
      }
    });
    await this.saveRuntimeState(now);
    return dispatches;
  }

  async markReminderNotificationDelivered(
    alertId: string,
    deliveredAt = this.#now?.() ?? new Date().toISOString()
  ): Promise<ReminderNotificationDelivery> {
    const delivery = this.reminderNotifications.markDelivered(alertId, deliveredAt);
    await this.saveRuntimeState(deliveredAt);
    return delivery;
  }

  async dismissReminderNotification(
    alertId: string,
    dismissedAt = this.#now?.() ?? new Date().toISOString()
  ): Promise<ReminderNotificationDelivery> {
    const delivery = this.reminderNotifications.dismiss(alertId, dismissedAt);
    await this.saveRuntimeState(dismissedAt);
    return delivery;
  }

  async snoozeReminderNotification(
    alertId: string,
    snoozedUntil: string,
    snoozedAt = this.#now?.() ?? new Date().toISOString()
  ): Promise<ReminderNotificationDelivery> {
    const delivery = this.reminderNotifications.snooze(alertId, snoozedUntil, snoozedAt);
    await this.saveRuntimeState(snoozedAt);
    return delivery;
  }

  async completeReminderNotification(
    alertId: string,
    completedAt = this.#now?.() ?? new Date().toISOString()
  ): Promise<ReminderNotificationDelivery> {
    const delivery = this.reminderNotifications.complete(alertId, completedAt);
    await this.saveRuntimeState(completedAt);
    return delivery;
  }

  async saveRuntimeState(updatedAt = this.#now?.() ?? new Date().toISOString()): Promise<void> {
    await this.runtimeStateStorage.save(createDesktopRuntimeStateSnapshot({
      updatedAt,
      reminderNotifications: this.reminderNotifications.snapshot(updatedAt),
      trustedDevices: this.syncSession.trustedDevices.list()
    }));
  }

  unlock(unlockedAt = this.#now?.() ?? new Date().toISOString()) {
    return this.security.unlock(unlockedAt);
  }

  lock() {
    return this.security.lock();
  }

  unlockCriticalFields(unlockedAt = this.#now?.() ?? new Date().toISOString()) {
    return this.security.unlockCriticalFields(unlockedAt);
  }

  canRevealField(sensitivity: FieldSensitivity, now = this.#now?.() ?? new Date().toISOString()): FieldRevealDecision {
    return this.security.canRevealField(sensitivity, now);
  }

  async revealFieldValue(input: {
    recordId: string;
    fieldKey: string;
    sensitivity: FieldSensitivity;
    valueCipher: string;
  }): Promise<string> {
    this.requireUnlocked();
    return decryptCryptoFieldValue({
      adapter: this.#adapter,
      key: this.#key,
      recordId: input.recordId,
      fieldKey: input.fieldKey,
      sensitivity: input.sensitivity,
      valueCipher: input.valueCipher,
      aadPrefix: this.cryptoState.fieldAadPrefix
    });
  }

  planClipboardClear(fieldKey: string, requestedAt = this.#now?.() ?? new Date().toISOString()): ClipboardClearPlan {
    return this.security.planClipboardClear(fieldKey, requestedAt);
  }

  beginPairing(input: BeginDesktopPairingInput = {}): FaceToFacePairingSession {
    this.requireUnlocked();
    return createDesktopPairingSession({
      localDevice: this.localDevice,
      sessionId: input.sessionId,
      localEndpoint: input.localEndpoint,
      ttlSeconds: input.ttlSeconds,
      now: this.#now,
      ids: this.#ids
    });
  }

  appendLocalSyncChange(change: SyncChange): SyncChange {
    this.requireUnlocked();
    return this.syncSession.changeLog.append(change);
  }

  async startLocalNetworkEndpoint(
    input: Omit<StartDesktopLocalNetworkEndpointInput, "session" | "now" | "ids"> = {}
  ): Promise<DesktopLocalNetworkEndpointServer> {
    this.requireUnlocked();
    return startDesktopLocalNetworkEndpoint({
      ...input,
      session: this.syncSession,
      now: this.#now,
      ids: this.#ids
    });
  }

  snapshot(now = this.#now?.() ?? new Date().toISOString()): DesktopRuntimeSnapshot {
    return {
      vaultName: this.session.repository.getManifest().name,
      deviceId: this.localDevice.id,
      records: this.session.getRecords().length,
      trustedDevices: this.syncSession.trustedDevices.list().length,
      dueReminders: this.getDueReminderPopups(now).length,
      lockState: this.security.refresh(now).lockState
    };
  }

  private requireUnlocked(now = this.#now?.() ?? new Date().toISOString()): void {
    if (this.security.refresh(now).lockState !== "unlocked") {
      throw new Error("Desktop runtime is locked");
    }
    this.security.touch(now);
  }
}

export async function createDesktopRuntime(input: CreateDesktopRuntimeInput): Promise<DesktopRuntime> {
  const cryptoMaterial = await createDesktopRuntimeCryptoMaterial(input);
  const { adapter, key, kdfParams, fieldAadPrefix } = cryptoMaterial;
  const encryptFieldValueAsync = createCryptoFieldEncryptor({
    adapter,
    key,
    aadPrefix: fieldAadPrefix
  });
  const storage = await createDesktopVaultStorage(input);
  const runtimeStateStorage = new DesktopFileRuntimeStateStorageAdapter(
    input.runtimeStatePath ?? createDefaultDesktopRuntimeStatePath(input.vaultPath)
  );
  const runtimeState = await runtimeStateStorage.load();
  const session = await DesktopVaultSession.load({
    storage,
    encryptFieldValueAsync,
    now: input.now,
    ids: input.ids
  }) ?? await DesktopVaultSession.createNew({
    name: input.vaultName,
    deviceId: input.localDevice.id,
    storage,
    encryptFieldValueAsync,
    now: input.now,
    ids: input.ids
  });

  const security = new VaultSecuritySession({
    autoLockSeconds: input.autoLockSeconds,
    secondUnlockSeconds: input.secondUnlockSeconds,
    copyClearSeconds: input.copyClearSeconds,
    now: input.now
  });
  security.unlock(input.now?.() ?? new Date().toISOString());

  return new DesktopRuntime({
    localDevice: input.localDevice,
    session,
    syncSession: new NearFieldSyncSession({
      localDevice: input.localDevice,
      trustedDevices: runtimeState?.trustedDevices ?? []
    }),
    storage,
    runtimeStateStorage,
    security,
    reminderNotifications: runtimeState
      ? ReminderNotificationCenter.fromState(runtimeState.reminderNotifications, input.now)
      : new ReminderNotificationCenter([], input.now),
    adapter,
    key,
    cryptoState: {
      kdfParams,
      fieldAadPrefix
    },
    now: input.now,
    ids: input.ids
  });
}

export async function restoreDesktopRuntimeFromEncryptedBackup(input: CreateDesktopRuntimeInput & {
  packageJson: string;
}): Promise<DesktopRuntime> {
  const cryptoMaterial = await createDesktopRuntimeCryptoMaterial(input);
  const { adapter, key, kdfParams, fieldAadPrefix } = cryptoMaterial;
  const encryptFieldValueAsync = createCryptoFieldEncryptor({
    adapter,
    key,
    aadPrefix: fieldAadPrefix
  });
  const vaultPackage = parseVaultPackage(input.packageJson);
  const snapshot = await restoreSnapshotFromVaultPackageAsync(
    vaultPackage,
    createCryptoPackageDecryptor({ adapter, key })
  );
  const storage = await createDesktopVaultStorage(input);
  const runtimeStateStorage = new DesktopFileRuntimeStateStorageAdapter(
    input.runtimeStatePath ?? createDefaultDesktopRuntimeStatePath(input.vaultPath)
  );
  const repository = InMemoryVaultRepository.fromSnapshot(snapshot, input.now);
  const session = DesktopVaultSession.fromRepository(repository, {
    storage,
    encryptFieldValueAsync,
    now: input.now,
    ids: input.ids
  });
  await session.save();
  const security = new VaultSecuritySession({
    autoLockSeconds: input.autoLockSeconds,
    secondUnlockSeconds: input.secondUnlockSeconds,
    copyClearSeconds: input.copyClearSeconds,
    now: input.now
  });
  security.unlock(input.now?.() ?? new Date().toISOString());
  const reminderNotifications = new ReminderNotificationCenter([], input.now);
  await runtimeStateStorage.save(createDesktopRuntimeStateSnapshot({
    updatedAt: input.now?.() ?? new Date().toISOString(),
    reminderNotifications: reminderNotifications.snapshot(input.now?.() ?? new Date().toISOString()),
    trustedDevices: []
  }));

  return new DesktopRuntime({
    localDevice: input.localDevice,
    session,
    syncSession: new NearFieldSyncSession({ localDevice: input.localDevice }),
    storage,
    runtimeStateStorage,
    security,
    reminderNotifications,
    adapter,
    key,
    cryptoState: {
      kdfParams,
      fieldAadPrefix
    },
    now: input.now,
    ids: input.ids
  });
}

async function createDesktopVaultStorage(input: CreateDesktopRuntimeInput): Promise<VaultStorageAdapter> {
  if (input.storageKind === "sqlite") {
    return DesktopSqliteVaultStorageAdapter.open(input.sqliteVaultPath ?? `${input.vaultPath}.sqlite`);
  }
  return new DesktopFileVaultStorageAdapter(input.vaultPath);
}

export function createDesktopRuntimeCryptoState(
  adapter: CryptoAdapter,
  localDeviceId: string,
  saltBase64?: string,
  kdfParams: Omit<KdfParams, "saltBase64"> = DEFAULT_WEB_CRYPTO_KDF_PARAMS
): DesktopRuntimeCryptoState & { saltBase64: string } {
  const salt = saltBase64 ?? toBase64(adapter.randomBytes(16));
  return {
    saltBase64: salt,
    kdfParams: {
      ...kdfParams,
      saltBase64: salt
    },
    fieldAadPrefix: `desktop:${localDeviceId}:field`
  };
}

async function createDesktopRuntimeCryptoMaterial(input: CreateDesktopRuntimeInput): Promise<{
  adapter: CryptoAdapter;
  key: Uint8Array;
  kdfParams: KdfParams;
  fieldAadPrefix: string;
}> {
  const adapter = input.cryptoAdapter ?? createWebCryptoAesGcmAdapter();
  const kdfDefaults = input.cryptoKdfParams
    ?? (input.cryptoAdapter ? DEFAULT_KDF_PARAMS : DEFAULT_WEB_CRYPTO_KDF_PARAMS);
  const state = createDesktopRuntimeCryptoState(
    adapter,
    input.localDevice.id,
    input.saltBase64,
    {
      ...kdfDefaults,
      iterations: input.kdfIterations ?? kdfDefaults.iterations
    }
  );
  return {
    adapter,
    key: await adapter.deriveKey(input.password, state.kdfParams),
    kdfParams: state.kdfParams,
    fieldAadPrefix: state.fieldAadPrefix
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}
