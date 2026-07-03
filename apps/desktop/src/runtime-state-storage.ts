import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  assertReminderNotificationState,
  createReminderNotificationState,
  parseReminderNotificationState,
  serializeReminderNotificationState,
  type ReminderNotificationState
} from "../../../packages/vault-core/src/index.ts";
import type { DeviceIdentity } from "../../../packages/sync-core/src/index.ts";

export const DESKTOP_RUNTIME_STATE_VERSION = 1;

export interface DesktopRuntimeStateSnapshot {
  runtimeStateVersion: typeof DESKTOP_RUNTIME_STATE_VERSION;
  updatedAt: string;
  reminderNotifications: ReminderNotificationState;
  trustedDevices: DeviceIdentity[];
}

export interface DesktopRuntimeStateStorageAdapter {
  exists(): Promise<boolean>;
  load(): Promise<DesktopRuntimeStateSnapshot | undefined>;
  save(snapshot: DesktopRuntimeStateSnapshot): Promise<void>;
  delete(): Promise<void>;
}

export class DesktopFileRuntimeStateStorageAdapter implements DesktopRuntimeStateStorageAdapter {
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

  async load(): Promise<DesktopRuntimeStateSnapshot | undefined> {
    try {
      const json = await readFile(this.path, "utf8");
      return parseDesktopRuntimeStateSnapshot(json);
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async save(snapshot: DesktopRuntimeStateSnapshot): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.tmp`;
    try {
      await writeFile(tempPath, serializeDesktopRuntimeStateSnapshot(snapshot), "utf8");
      parseDesktopRuntimeStateSnapshot(await readFile(tempPath, "utf8"));
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

export function createDefaultDesktopRuntimeStatePath(vaultPath: string): string {
  return `${vaultPath}.runtime-state.json`;
}

export function createDesktopRuntimeStateSnapshot(input: {
  reminderNotifications?: ReminderNotificationState;
  trustedDevices?: readonly DeviceIdentity[];
  updatedAt: string;
}): DesktopRuntimeStateSnapshot {
  const snapshot: DesktopRuntimeStateSnapshot = {
    runtimeStateVersion: DESKTOP_RUNTIME_STATE_VERSION,
    updatedAt: input.updatedAt,
    reminderNotifications: input.reminderNotifications
      ?? createReminderNotificationState([], input.updatedAt),
    trustedDevices: cloneTrustedDevices(input.trustedDevices ?? [])
  };
  assertDesktopRuntimeStateSnapshot(snapshot);
  return snapshot;
}

export function serializeDesktopRuntimeStateSnapshot(snapshot: DesktopRuntimeStateSnapshot): string {
  assertDesktopRuntimeStateSnapshot(snapshot);
  return JSON.stringify(snapshot, null, 2);
}

export function parseDesktopRuntimeStateSnapshot(json: string): DesktopRuntimeStateSnapshot {
  const parsed = JSON.parse(json) as DesktopRuntimeStateSnapshot;
  parsed.trustedDevices = cloneTrustedDevices(parsed.trustedDevices ?? []);
  assertDesktopRuntimeStateSnapshot(parsed);
  return parsed;
}

export function assertDesktopRuntimeStateSnapshot(snapshot: DesktopRuntimeStateSnapshot): void {
  if (snapshot.runtimeStateVersion !== DESKTOP_RUNTIME_STATE_VERSION) {
    throw new Error(`Unsupported desktop runtime state version: ${snapshot.runtimeStateVersion}`);
  }
  if (!isIsoDateTime(snapshot.updatedAt)) {
    throw new Error("Desktop runtime state updatedAt must be an ISO date-time string");
  }
  assertReminderNotificationState(snapshot.reminderNotifications);
  if (!Array.isArray(snapshot.trustedDevices)) {
    throw new Error("Desktop runtime state trustedDevices must be an array");
  }
  for (const device of snapshot.trustedDevices) {
    assertDeviceIdentity(device);
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isIsoDateTime(value: string): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time) && value.includes("T");
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
