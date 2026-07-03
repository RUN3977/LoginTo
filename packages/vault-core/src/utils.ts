export type Clock = () => string;

export interface IdFactory {
  nextId(prefix: string): string;
}

export const systemClock: Clock = () => new Date().toISOString();

export const defaultIdFactory: IdFactory = {
  nextId: createLocalId
};

export function createLocalId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return `${cleanPrefix}_${randomUuid.replace(/-/g, "")}`;
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const fallback = hex || Math.random().toString(36).slice(2).padEnd(20, "0");
  return `${cleanPrefix}_${fallback}`;
}

export function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`${label} must not be empty`);
  }
}

export function isIsoDateTime(value: string): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time) && value.includes("T");
}

export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
