import type { ReminderAlert, VaultRecord } from "./index.ts";
import { getDueReminderAlerts } from "./reminder-engine.ts";
import { cloneValue, isIsoDateTime, systemClock, type Clock } from "./utils.ts";

export const REMINDER_NOTIFICATION_STATE_VERSION = 1;

export type ReminderNotificationStatus =
  | "pending"
  | "delivered"
  | "snoozed"
  | "completed"
  | "dismissed";

export interface ReminderNotificationDelivery {
  id: string;
  alertId: string;
  reminderId: string;
  recordId: string;
  recordTitle: string;
  title: string;
  message: string;
  dueAt: string;
  triggerAt: string;
  status: ReminderNotificationStatus;
  createdAt: string;
  lastStatusAt: string;
  deliveredAt?: string;
  snoozedUntil?: string;
  dismissedAt?: string;
  completedAt?: string;
}

export interface ReminderNotificationState {
  stateVersion: typeof REMINDER_NOTIFICATION_STATE_VERSION;
  updatedAt: string;
  deliveries: ReminderNotificationDelivery[];
}

export class ReminderNotificationCenter {
  #deliveries = new Map<string, ReminderNotificationDelivery>();
  #now: Clock;

  constructor(deliveries: readonly ReminderNotificationDelivery[] = [], now: Clock = systemClock) {
    this.#now = now;
    for (const delivery of deliveries) {
      if (this.#deliveries.has(delivery.alertId)) {
        throw new Error(`Duplicate reminder notification alert id: ${delivery.alertId}`);
      }
      this.#deliveries.set(delivery.alertId, cloneValue(delivery));
    }
  }

  static fromState(
    state: ReminderNotificationState,
    now: Clock = systemClock
  ): ReminderNotificationCenter {
    assertReminderNotificationState(state);
    return new ReminderNotificationCenter(state.deliveries, now);
  }

  collectDue(records: readonly VaultRecord[], now = this.#now()): ReminderNotificationDelivery[] {
    assertIsoDateTime(now, "now");
    const nowTime = Date.parse(now);
    const dueAlerts = getDueReminderAlerts(records, now);
    const dueDeliveries: ReminderNotificationDelivery[] = [];

    for (const alert of dueAlerts) {
      const alertId = createReminderNotificationAlertId(alert);
      const existing = this.#deliveries.get(alertId);
      if (!existing) {
        const delivery = createDeliveryFromAlert(alert, alertId, now);
        this.#deliveries.set(alertId, delivery);
        dueDeliveries.push(cloneValue(delivery));
        continue;
      }

      if (existing.status === "pending") {
        dueDeliveries.push(cloneValue(existing));
        continue;
      }

      if (existing.status === "snoozed" && existing.snoozedUntil && Date.parse(existing.snoozedUntil) <= nowTime) {
        const nextDelivery: ReminderNotificationDelivery = {
          ...existing,
          title: alert.title,
          message: alert.body,
          dueAt: alert.dueAt,
          triggerAt: existing.snoozedUntil,
          status: "pending",
          lastStatusAt: now
        };
        this.#deliveries.set(alertId, cloneValue(nextDelivery));
        dueDeliveries.push(cloneValue(nextDelivery));
      }
    }

    return dueDeliveries.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt));
  }

  markDelivered(alertId: string, deliveredAt = this.#now()): ReminderNotificationDelivery {
    assertIsoDateTime(deliveredAt, "deliveredAt");
    return this.#updateDelivery(alertId, (delivery) => ({
      ...delivery,
      status: "delivered",
      deliveredAt,
      lastStatusAt: deliveredAt
    }));
  }

  dismiss(alertId: string, dismissedAt = this.#now()): ReminderNotificationDelivery {
    assertIsoDateTime(dismissedAt, "dismissedAt");
    return this.#updateDelivery(alertId, (delivery) => ({
      ...delivery,
      status: "dismissed",
      dismissedAt,
      lastStatusAt: dismissedAt
    }));
  }

  snooze(alertId: string, snoozedUntil: string, snoozedAt = this.#now()): ReminderNotificationDelivery {
    assertIsoDateTime(snoozedUntil, "snoozedUntil");
    assertIsoDateTime(snoozedAt, "snoozedAt");
    if (Date.parse(snoozedUntil) <= Date.parse(snoozedAt)) {
      throw new Error("snoozedUntil must be later than snoozedAt");
    }
    return this.#updateDelivery(alertId, (delivery) => ({
      ...delivery,
      status: "snoozed",
      snoozedUntil,
      lastStatusAt: snoozedAt
    }));
  }

  complete(alertId: string, completedAt = this.#now()): ReminderNotificationDelivery {
    assertIsoDateTime(completedAt, "completedAt");
    return this.#updateDelivery(alertId, (delivery) => ({
      ...delivery,
      status: "completed",
      completedAt,
      lastStatusAt: completedAt
    }));
  }

  list(): ReminderNotificationDelivery[] {
    return Array.from(this.#deliveries.values())
      .map((delivery) => cloneValue(delivery))
      .sort((a, b) => b.lastStatusAt.localeCompare(a.lastStatusAt));
  }

  pending(): ReminderNotificationDelivery[] {
    return this.list().filter((delivery) => delivery.status === "pending");
  }

  snapshot(updatedAt = this.#now()): ReminderNotificationState {
    return createReminderNotificationState(this.list(), updatedAt);
  }

  #updateDelivery(
    alertId: string,
    update: (delivery: ReminderNotificationDelivery) => ReminderNotificationDelivery
  ): ReminderNotificationDelivery {
    const current = this.#deliveries.get(alertId);
    if (!current) {
      throw new Error(`Reminder notification does not exist: ${alertId}`);
    }
    const next = update(cloneValue(current));
    this.#deliveries.set(alertId, cloneValue(next));
    return cloneValue(next);
  }
}

export function createReminderNotificationAlertId(alert: ReminderAlert): string {
  return ["reminder", alert.recordId, alert.id, alert.triggerAt].join(":");
}

export function createReminderNotificationState(
  deliveries: readonly ReminderNotificationDelivery[],
  updatedAt: string = systemClock()
): ReminderNotificationState {
  const state: ReminderNotificationState = {
    stateVersion: REMINDER_NOTIFICATION_STATE_VERSION,
    updatedAt,
    deliveries: cloneValue([...deliveries]).sort((a, b) => a.alertId.localeCompare(b.alertId))
  };
  assertReminderNotificationState(state);
  return state;
}

export function serializeReminderNotificationState(state: ReminderNotificationState): string {
  assertReminderNotificationState(state);
  return JSON.stringify(state, null, 2);
}

export function parseReminderNotificationState(json: string): ReminderNotificationState {
  const parsed = JSON.parse(json) as ReminderNotificationState;
  assertReminderNotificationState(parsed);
  return parsed;
}

export function assertReminderNotificationState(state: ReminderNotificationState): void {
  if (state.stateVersion !== REMINDER_NOTIFICATION_STATE_VERSION) {
    throw new Error(`Unsupported reminder notification state version: ${state.stateVersion}`);
  }
  assertIsoDateTime(state.updatedAt, "updatedAt");
  if (!Array.isArray(state.deliveries)) {
    throw new Error("Reminder notification state deliveries must be an array");
  }

  const alertIds = new Set<string>();
  for (const delivery of state.deliveries) {
    assertReminderNotificationDelivery(delivery);
    if (alertIds.has(delivery.alertId)) {
      throw new Error(`Duplicate reminder notification alert id: ${delivery.alertId}`);
    }
    alertIds.add(delivery.alertId);
  }
}

function createDeliveryFromAlert(
  alert: ReminderAlert,
  alertId: string,
  createdAt: string
): ReminderNotificationDelivery {
  return {
    id: alertId,
    alertId,
    reminderId: alert.id,
    recordId: alert.recordId,
    recordTitle: alert.recordTitle,
    title: alert.title,
    message: alert.body,
    dueAt: alert.dueAt,
    triggerAt: alert.triggerAt,
    status: "pending",
    createdAt,
    lastStatusAt: createdAt
  };
}

function assertIsoDateTime(value: string, label: string): void {
  if (!isIsoDateTime(value)) {
    throw new Error(`${label} must be an ISO date-time string`);
  }
}

function assertReminderNotificationDelivery(delivery: ReminderNotificationDelivery): void {
  for (const key of [
    "id",
    "alertId",
    "reminderId",
    "recordId",
    "recordTitle",
    "title",
    "message",
    "dueAt",
    "triggerAt",
    "createdAt",
    "lastStatusAt"
  ] as const) {
    if (typeof delivery[key] !== "string" || !delivery[key].trim()) {
      throw new Error(`Reminder notification delivery ${key} must be a non-empty string`);
    }
  }

  if (!isReminderNotificationStatus(delivery.status)) {
    throw new Error(`Unsupported reminder notification status: ${delivery.status}`);
  }

  assertIsoDateTime(delivery.dueAt, "dueAt");
  assertIsoDateTime(delivery.triggerAt, "triggerAt");
  assertIsoDateTime(delivery.createdAt, "createdAt");
  assertIsoDateTime(delivery.lastStatusAt, "lastStatusAt");
  for (const key of ["deliveredAt", "snoozedUntil", "dismissedAt", "completedAt"] as const) {
    if (delivery[key]) {
      assertIsoDateTime(delivery[key], key);
    }
  }
}

function isReminderNotificationStatus(value: string): value is ReminderNotificationStatus {
  return value === "pending"
    || value === "delivered"
    || value === "snoozed"
    || value === "completed"
    || value === "dismissed";
}
