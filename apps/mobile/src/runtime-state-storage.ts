import {
  assertReminderNotificationState,
  createReminderNotificationState,
  type ReminderNotificationState
} from "../../../packages/vault-core/src/index.ts";
import type { DeviceIdentity } from "../../../packages/sync-core/src/index.ts";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const MOBILE_RUNTIME_STATE_VERSION = 1;

export interface MobileRuntimeStateSnapshot {
  runtimeStateVersion: typeof MOBILE_RUNTIME_STATE_VERSION;
  updatedAt: string;
  reminderNotifications: ReminderNotificationState;
  trustedDevices: DeviceIdentity[];
}

export interface MobileRuntimeStateStorageAdapter {
  exists?(): Promise<boolean>;
  load(): Promise<MobileRuntimeStateSnapshot | undefined>;
  save(snapshot: MobileRuntimeStateSnapshot): Promise<void>;
  delete(): Promise<void>;
}

export class MobileFileRuntimeStateStorageAdapter implements MobileRuntimeStateStorageAdapter {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  async exists(): Promise<boolean> {
    try {
      await readFile(this.path);
      return true;
    } catch (error) {
      if (isMissingFileError(error)) {
        return false;
      }
      throw error;
    }
  }

  async load(): Promise<MobileRuntimeStateSnapshot | undefined> {
    try {
      const json = await readFile(this.path, "utf8");
      return parseMobileRuntimeStateSnapshot(json);
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async save(snapshot: MobileRuntimeStateSnapshot): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.tmp`;
    try {
      await writeFile(tempPath, serializeMobileRuntimeStateSnapshot(snapshot), "utf8");
      parseMobileRuntimeStateSnapshot(await readFile(tempPath, "utf8"));
      await rename(tempPath, this.path);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  async delete(): Promise<void> {
    await rm(this.path, { force: true });
    await rm(`${this.path}.tmp`, { force: true });
  }
}

export function createDefaultMobileRuntimeStatePath(vaultPath: string): string {
  return `${vaultPath}.runtime-state.json`;
}

export class MobileMemoryRuntimeStateStorageAdapter implements MobileRuntimeStateStorageAdapter {
  #snapshot?: MobileRuntimeStateSnapshot;

  constructor(snapshot?: MobileRuntimeStateSnapshot) {
    this.#snapshot = snapshot ? cloneMobileRuntimeStateSnapshot(snapshot) : undefined;
  }

  async load(): Promise<MobileRuntimeStateSnapshot | undefined> {
    return this.#snapshot ? cloneMobileRuntimeStateSnapshot(this.#snapshot) : undefined;
  }

  async save(snapshot: MobileRuntimeStateSnapshot): Promise<void> {
    assertMobileRuntimeStateSnapshot(snapshot);
    this.#snapshot = cloneMobileRuntimeStateSnapshot(snapshot);
  }

  async delete(): Promise<void> {
    this.#snapshot = undefined;
  }
}

export function createMobileRuntimeStateSnapshot(input: {
  reminderNotifications?: ReminderNotificationState;
  trustedDevices?: readonly DeviceIdentity[];
  updatedAt: string;
}): MobileRuntimeStateSnapshot {
  const snapshot: MobileRuntimeStateSnapshot = {
    runtimeStateVersion: MOBILE_RUNTIME_STATE_VERSION,
    updatedAt: input.updatedAt,
    reminderNotifications: input.reminderNotifications
      ?? createReminderNotificationState([], input.updatedAt),
    trustedDevices: cloneTrustedDevices(input.trustedDevices ?? [])
  };
  assertMobileRuntimeStateSnapshot(snapshot);
  return snapshot;
}

export function serializeMobileRuntimeStateSnapshot(snapshot: MobileRuntimeStateSnapshot): string {
  assertMobileRuntimeStateSnapshot(snapshot);
  return JSON.stringify(snapshot, null, 2);
}

export function parseMobileRuntimeStateSnapshot(json: string): MobileRuntimeStateSnapshot {
  const parsed = JSON.parse(json) as MobileRuntimeStateSnapshot;
  parsed.trustedDevices = cloneTrustedDevices(parsed.trustedDevices ?? []);
  assertMobileRuntimeStateSnapshot(parsed);
  return parsed;
}

export function assertMobileRuntimeStateSnapshot(snapshot: MobileRuntimeStateSnapshot): void {
  if (snapshot.runtimeStateVersion !== MOBILE_RUNTIME_STATE_VERSION) {
    throw new Error(`Unsupported mobile runtime state version: ${snapshot.runtimeStateVersion}`);
  }
  if (!isIsoDateTime(snapshot.updatedAt)) {
    throw new Error("Mobile runtime state updatedAt must be an ISO date-time string");
  }
  assertReminderNotificationState(snapshot.reminderNotifications);
  if (!Array.isArray(snapshot.trustedDevices)) {
    throw new Error("Mobile runtime state trustedDevices must be an array");
  }
  for (const device of snapshot.trustedDevices) {
    assertDeviceIdentity(device);
  }
}

function cloneMobileRuntimeStateSnapshot(snapshot: MobileRuntimeStateSnapshot): MobileRuntimeStateSnapshot {
  return {
    runtimeStateVersion: snapshot.runtimeStateVersion,
    updatedAt: snapshot.updatedAt,
    reminderNotifications: {
      stateVersion: snapshot.reminderNotifications.stateVersion,
      updatedAt: snapshot.reminderNotifications.updatedAt,
      deliveries: snapshot.reminderNotifications.deliveries.map((delivery) => ({ ...delivery }))
    },
    trustedDevices: cloneTrustedDevices(snapshot.trustedDevices)
  };
}

function cloneTrustedDevices(devices: readonly DeviceIdentity[]): DeviceIdentity[] {
  return devices.map((device) => ({ ...device }));
}

function assertDeviceIdentity(device: DeviceIdentity): void {
  if (!device.id?.trim()) {
    throw new Error("Trusted device id must not be empty");
  }
  if (!device.name?.trim()) {
    throw new Error("Trusted device name must not be empty");
  }
  if (device.kind !== "desktop" && device.kind !== "phone" && device.kind !== "tablet") {
    throw new Error(`Unsupported trusted device kind: ${device.kind}`);
  }
  if (!device.publicKeyBase64?.trim()) {
    throw new Error("Trusted device public key must not be empty");
  }
  if (device.trustedAt && !isIsoDateTime(device.trustedAt)) {
    throw new Error("Trusted device trustedAt must be an ISO date-time string");
  }
  if (device.lastSeenAt && !isIsoDateTime(device.lastSeenAt)) {
    throw new Error("Trusted device lastSeenAt must be an ISO date-time string");
  }
}

function isIsoDateTime(value: string): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time) && value.includes("T");
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
