import {
  DEFAULT_KDF_PARAMS,
  DEFAULT_WEB_CRYPTO_KDF_PARAMS,
  VaultSecuritySession,
  createCryptoPackageDecryptor,
  createCryptoPackageEncryptor,
  createCryptoFieldEncryptor,
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
  createVaultManifest,
  createVaultRecordAsync,
  deliverTerminalReminderNotifications,
  getDueReminderAlerts,
  parseVaultPackage,
  restoreSnapshotFromVaultPackageAsync,
  serializeVaultPackage,
  type Clock,
  type FieldSensitivity,
  type FieldUpdate,
  type IdFactory,
  type RecordDraft,
  type ReminderAlert,
  type ReminderNotificationDelivery,
  type TerminalNotificationAdapter,
  type TerminalReminderNotificationDispatch,
  type VaultStorageAdapter,
  type VaultPackage,
  type VaultRecord
} from "../../../packages/vault-core/src/index.ts";
import {
  NearFieldSyncSession,
  sendNearFieldRequest,
  type DeviceIdentity,
  type FaceToFacePairingSession,
  type PairingMatrix,
  type PairingQrCode,
  type NearFieldEndpointDescriptor,
  type NearFieldEndpointResponseBody,
  type NearFieldResponse,
  type PairingVerification,
  type SyncChange,
  type SyncExchangePackage
} from "../../../packages/sync-core/src/index.ts";
import {
  prepareMobileEncryptedCapture,
  type PrepareMobileEncryptedCaptureInput,
  type PreparedMobileEncryptedCapture
} from "./encrypted-capture.ts";
import { MobileLocalNetworkTransportAdapter } from "./local-network-transport.ts";
import {
  commitMobileOcrCaptureAsync,
  startMobileOcrCapture,
  type CommitMobileOcrCaptureAsyncInput,
  type MobileOcrCaptureSession,
  type StartMobileOcrCaptureInput
} from "./ocr-capture-workflow.ts";
import { createMobilePairingSession } from "./pairing-workflow.ts";
import {
  confirmMobilePairingTrust,
  scanDesktopPairingQr,
  scanDesktopPairingMatrix,
  sendMobilePairingRequest,
  type MobilePairingRequestResult,
  type ScannedDesktopPairingTarget
} from "./pairing-client.ts";
import {
  MobileMemoryRuntimeStateStorageAdapter,
  createMobileRuntimeStateSnapshot,
  type MobileRuntimeStateStorageAdapter
} from "./runtime-state-storage.ts";

export interface CreateMobileRuntimeInput {
  vaultName: string;
  password: string;
  localDevice: DeviceIdentity & { kind: "phone" | "tablet" };
  saltBase64?: string;
  kdfIterations?: number;
  cryptoAdapter?: CryptoAdapter;
  cryptoKdfParams?: Omit<KdfParams, "saltBase64">;
  autoLockSeconds?: number;
  secondUnlockSeconds?: number;
  copyClearSeconds?: number;
  runtimeStateStorage?: MobileRuntimeStateStorageAdapter;
  vaultStorage?: VaultStorageAdapter;
  now?: Clock;
  ids?: IdFactory;
}

export interface MobileRuntimeCryptoState {
  kdfParams: KdfParams;
  fieldAadPrefix: string;
}

export interface BeginMobilePairingInput {
  localEndpoint?: string;
  ttlSeconds?: number;
}

export interface MobileRuntimeSnapshot {
  vaultName: string;
  deviceId: string;
  records: number;
  trustedDevices: number;
  dueReminders: number;
  lockState: "locked" | "unlocked";
}

export class MobileRuntime {
  readonly localDevice: DeviceIdentity & { kind: "phone" | "tablet" };
  readonly repository: InMemoryVaultRepository;
  readonly syncSession: NearFieldSyncSession;
  readonly cryptoState: MobileRuntimeCryptoState;
  readonly security: VaultSecuritySession;
  readonly reminderNotifications: ReminderNotificationCenter;
  readonly runtimeStateStorage: MobileRuntimeStateStorageAdapter;
  readonly vaultStorage?: VaultStorageAdapter;
  readonly transport = new MobileLocalNetworkTransportAdapter();
  #adapter: CryptoAdapter;
  #key: Uint8Array;
  #now?: Clock;
  #ids?: IdFactory;

  constructor(input: {
    localDevice: DeviceIdentity & { kind: "phone" | "tablet" };
    repository: InMemoryVaultRepository;
    syncSession: NearFieldSyncSession;
    cryptoState: MobileRuntimeCryptoState;
    security: VaultSecuritySession;
    reminderNotifications: ReminderNotificationCenter;
    runtimeStateStorage: MobileRuntimeStateStorageAdapter;
    vaultStorage?: VaultStorageAdapter;
    adapter: CryptoAdapter;
    key: Uint8Array;
    now?: Clock;
    ids?: IdFactory;
  }) {
    this.localDevice = input.localDevice;
    this.repository = input.repository;
    this.syncSession = input.syncSession;
    this.cryptoState = input.cryptoState;
    this.security = input.security;
    this.reminderNotifications = input.reminderNotifications;
    this.runtimeStateStorage = input.runtimeStateStorage;
    this.vaultStorage = input.vaultStorage;
    this.#adapter = input.adapter;
    this.#key = input.key;
    this.#now = input.now;
    this.#ids = input.ids;
  }

  async prepareEncryptedCapture(
    input: Omit<PrepareMobileEncryptedCaptureInput, "adapter" | "key" | "ids">
  ): Promise<PreparedMobileEncryptedCapture> {
    this.requireUnlocked();
    return prepareMobileEncryptedCapture({
      ...input,
      adapter: this.#adapter,
      key: this.#key,
      ids: this.#ids
    });
  }

  startOcrCapture(input: Omit<StartMobileOcrCaptureInput, "now" | "ids">): MobileOcrCaptureSession {
    this.requireUnlocked();
    return startMobileOcrCapture({
      ...input,
      now: this.#now,
      ids: this.#ids
    });
  }

  async commitOcrCapture(
    input: Omit<CommitMobileOcrCaptureAsyncInput, "repository" | "encryptFieldValue" | "now" | "ids">
  ): Promise<VaultRecord> {
    this.requireUnlocked();
    const record = await commitMobileOcrCaptureAsync({
      ...input,
      repository: this.repository,
      encryptFieldValue: createCryptoFieldEncryptor({
        adapter: this.#adapter,
        key: this.#key,
        aadPrefix: this.cryptoState.fieldAadPrefix
      }),
      now: this.#now,
      ids: this.#ids
    });
    await this.saveVaultState();
    return record;
  }

  getDueReminderPopups(now = this.#now?.() ?? new Date().toISOString()): ReminderAlert[] {
    return getDueReminderAlerts(this.repository.listRecords(), now);
  }

  async collectDueReminderNotifications(now = this.#now?.() ?? new Date().toISOString()): Promise<ReminderNotificationDelivery[]> {
    const deliveries = this.reminderNotifications.collectDue(this.repository.listRecords(), now);
    await this.saveRuntimeState(now);
    return deliveries;
  }

  async deliverDueTerminalReminderNotifications(
    adapter: TerminalNotificationAdapter,
    now = this.#now?.() ?? new Date().toISOString()
  ): Promise<TerminalReminderNotificationDispatch[]> {
    const deliveries = this.reminderNotifications.collectDue(this.repository.listRecords(), now);
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

  async createRecord(input: {
    draft: RecordDraft;
    favorite?: boolean;
  }): Promise<VaultRecord> {
    this.requireUnlocked();
    const record = await createVaultRecordAsync({
      draft: input.draft,
      encryptFieldValue: createCryptoFieldEncryptor({
        adapter: this.#adapter,
        key: this.#key,
        aadPrefix: this.cryptoState.fieldAadPrefix
      }),
      now: this.#now,
      ids: this.#ids
    });
    this.repository.insertRecord(record);
    if (input.favorite) {
      this.repository.updateRecordMetadata(record.id, { favorite: true });
    }
    await this.saveVaultState();
    return this.repository.getRecord(record.id) ?? record;
  }

  async updateRecordFields(recordId: string, updates: FieldUpdate[]): Promise<VaultRecord> {
    this.requireUnlocked();
    const record = await this.repository.updateRecordFieldsAsync(
      recordId,
      updates,
      createCryptoFieldEncryptor({
        adapter: this.#adapter,
        key: this.#key,
        aadPrefix: this.cryptoState.fieldAadPrefix
      })
    );
    await this.saveVaultState();
    return record;
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

  async exportEncryptedBackupPackage(): Promise<VaultPackage> {
    this.requireUnlocked();
    return createVaultPackageAsync({
      snapshot: this.repository.snapshot(),
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

  async verifyEncryptedBackupPackage(packageJson: string) {
    this.requireUnlocked();
    const vaultPackage = parseVaultPackage(packageJson);
    return restoreSnapshotFromVaultPackageAsync(
      vaultPackage,
      createCryptoPackageDecryptor({
        adapter: this.#adapter,
        key: this.#key
      })
    );
  }

  planClipboardClear(fieldKey: string, requestedAt = this.#now?.() ?? new Date().toISOString()): ClipboardClearPlan {
    return this.security.planClipboardClear(fieldKey, requestedAt);
  }

  beginPairing(input: BeginMobilePairingInput = {}): FaceToFacePairingSession {
    this.requireUnlocked();
    return createMobilePairingSession({
      localDevice: this.localDevice,
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

  createOutgoingExchangePackage(receiverDeviceId?: string): SyncExchangePackage {
    this.requireUnlocked();
    return this.syncSession.createOutgoingExchangePackage({
      receiverDeviceId,
      now: this.#now,
      ids: this.#ids
    });
  }

  async sendExchangePackage(
    descriptor: NearFieldEndpointDescriptor,
    exchangePackage: SyncExchangePackage
  ): Promise<NearFieldResponse<NearFieldEndpointResponseBody>> {
    this.requireUnlocked();
    return sendNearFieldRequest({
      transport: this.transport,
      descriptor,
      route: "/sync/exchange",
      senderDeviceId: this.localDevice.id,
      body: {
        exchangePackage,
        transport: "local-network"
      },
      now: this.#now,
      ids: this.#ids
    });
  }

  async sendPairingRequest(
    descriptor: NearFieldEndpointDescriptor,
    input: Omit<Parameters<typeof sendMobilePairingRequest>[0], "transport" | "descriptor" | "localDevice" | "now" | "ids"> = {}
  ): Promise<MobilePairingRequestResult> {
    this.requireUnlocked();
    return sendMobilePairingRequest({
      ...input,
      transport: this.transport,
      descriptor,
      localDevice: this.localDevice,
      now: this.#now,
      ids: this.#ids
    });
  }

  async scanPairingMatrixAndRequest(
    matrix: Pick<PairingMatrix, "size" | "cells">,
    input: Omit<Parameters<typeof sendMobilePairingRequest>[0], "transport" | "descriptor" | "localDevice" | "now" | "ids"> = {}
  ): Promise<MobilePairingRequestResult & { scannedTarget: ScannedDesktopPairingTarget }> {
    this.requireUnlocked();
    const scannedTarget = scanDesktopPairingMatrix({
      matrix,
      now: this.#now?.() ?? new Date().toISOString()
    });
    const pairing = await sendMobilePairingRequest({
      ...input,
      transport: this.transport,
      descriptor: scannedTarget.descriptor,
      localDevice: this.localDevice,
      now: this.#now,
      ids: this.#ids
    });
    return {
      ...pairing,
      scannedTarget
    };
  }

  async scanPairingQrAndRequest(
    payloadText: PairingQrCode["payloadText"],
    input: Omit<Parameters<typeof sendMobilePairingRequest>[0], "transport" | "descriptor" | "localDevice" | "now" | "ids"> = {}
  ): Promise<MobilePairingRequestResult & { scannedTarget: ScannedDesktopPairingTarget }> {
    this.requireUnlocked();
    const scannedTarget = scanDesktopPairingQr({
      payloadText,
      now: this.#now?.() ?? new Date().toISOString()
    });
    const pairing = await sendMobilePairingRequest({
      ...input,
      transport: this.transport,
      descriptor: scannedTarget.descriptor,
      localDevice: this.localDevice,
      now: this.#now,
      ids: this.#ids
    });
    return {
      ...pairing,
      scannedTarget
    };
  }

  async confirmPairingTrust(session: FaceToFacePairingSession, confirmedCode: string): Promise<{
    trustedDevice: DeviceIdentity;
    verification: PairingVerification;
  }> {
    this.requireUnlocked();
    const verification = session.verification;
    if (!verification) {
      throw new Error("Pairing verification is not available");
    }
    const trustedDevice = confirmMobilePairingTrust({
      session,
      trustedDevices: this.syncSession.trustedDevices,
      confirmedCode,
      trustedAt: this.#now?.() ?? new Date().toISOString()
    });
    await this.saveRuntimeState(this.#now?.() ?? new Date().toISOString());
    return {
      trustedDevice,
      verification
    };
  }

  async saveRuntimeState(updatedAt = this.#now?.() ?? new Date().toISOString()): Promise<void> {
    await this.runtimeStateStorage.save(createMobileRuntimeStateSnapshot({
      updatedAt,
      reminderNotifications: this.reminderNotifications.snapshot(updatedAt),
      trustedDevices: this.syncSession.trustedDevices.list()
    }));
  }

  async saveVaultState(): Promise<void> {
    if (this.vaultStorage) {
      await this.repository.saveToStorage(this.vaultStorage);
    }
  }

  snapshot(now = this.#now?.() ?? new Date().toISOString()): MobileRuntimeSnapshot {
    return {
      vaultName: this.repository.getManifest().name,
      deviceId: this.localDevice.id,
      records: this.repository.listRecords().length,
      trustedDevices: this.syncSession.trustedDevices.list().length,
      dueReminders: this.getDueReminderPopups(now).length,
      lockState: this.security.refresh(now).lockState
    };
  }

  private requireUnlocked(now = this.#now?.() ?? new Date().toISOString()): void {
    if (this.security.refresh(now).lockState !== "unlocked") {
      throw new Error("Mobile runtime is locked");
    }
    this.security.touch(now);
  }
}

export async function createMobileRuntime(input: CreateMobileRuntimeInput): Promise<MobileRuntime> {
  const cryptoMaterial = await createMobileRuntimeCryptoMaterial(input);
  const { adapter, key, kdfParams, fieldAadPrefix } = cryptoMaterial;
  const manifest = createVaultManifest({
    name: input.vaultName,
    deviceId: input.localDevice.id,
    now: input.now,
    ids: input.ids
  });
  const repository = input.vaultStorage
    ? await InMemoryVaultRepository.loadFromStorage(input.vaultStorage, input.now)
      ?? new InMemoryVaultRepository(manifest, input.now)
    : new InMemoryVaultRepository(manifest, input.now);
  const runtimeStateStorage = input.runtimeStateStorage ?? new MobileMemoryRuntimeStateStorageAdapter();
  const runtimeState = await runtimeStateStorage.load();

  const security = new VaultSecuritySession({
    autoLockSeconds: input.autoLockSeconds,
    secondUnlockSeconds: input.secondUnlockSeconds,
    copyClearSeconds: input.copyClearSeconds,
    now: input.now
  });
  security.unlock(input.now?.() ?? new Date().toISOString());

  return new MobileRuntime({
    localDevice: input.localDevice,
    repository,
    syncSession: new NearFieldSyncSession({
      localDevice: input.localDevice,
      trustedDevices: runtimeState?.trustedDevices ?? []
    }),
    security,
    reminderNotifications: runtimeState
      ? ReminderNotificationCenter.fromState(runtimeState.reminderNotifications, input.now)
      : new ReminderNotificationCenter([], input.now),
    runtimeStateStorage,
    vaultStorage: input.vaultStorage,
    cryptoState: {
      kdfParams,
      fieldAadPrefix
    },
    adapter,
    key,
    now: input.now,
    ids: input.ids
  });
}

export function createMobileRuntimeCryptoState(
  adapter: CryptoAdapter,
  localDeviceId: string,
  saltBase64?: string,
  kdfParams: Omit<KdfParams, "saltBase64"> = DEFAULT_WEB_CRYPTO_KDF_PARAMS
): MobileRuntimeCryptoState & { saltBase64: string } {
  const salt = saltBase64 ?? toBase64(adapter.randomBytes(16));
  return {
    saltBase64: salt,
    kdfParams: {
      ...kdfParams,
      saltBase64: salt
    },
    fieldAadPrefix: `mobile:${localDeviceId}:field`
  };
}

async function createMobileRuntimeCryptoMaterial(input: CreateMobileRuntimeInput): Promise<{
  adapter: CryptoAdapter;
  key: Uint8Array;
  kdfParams: KdfParams;
  fieldAadPrefix: string;
}> {
  const adapter = input.cryptoAdapter ?? createWebCryptoAesGcmAdapter();
  const kdfDefaults = input.cryptoKdfParams
    ?? (input.cryptoAdapter ? DEFAULT_KDF_PARAMS : DEFAULT_WEB_CRYPTO_KDF_PARAMS);
  const state = createMobileRuntimeCryptoState(
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
