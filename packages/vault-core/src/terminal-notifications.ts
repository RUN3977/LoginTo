import type { ReminderNotificationDelivery } from "./reminder-notifications.ts";
import { assertNonEmpty, isIsoDateTime, systemClock, type Clock } from "./utils.ts";

export type TerminalNotificationPermissionStatus = "granted" | "denied" | "prompt" | "unsupported";

export type TerminalReminderNotificationAction = "open" | "snooze" | "complete" | "dismiss";

export interface TerminalNotificationPermission {
  status: TerminalNotificationPermissionStatus;
  canAskAgain: boolean;
}

export interface TerminalReminderNotificationActionButton {
  id: TerminalReminderNotificationAction;
  label: string;
}

export interface TerminalReminderNotificationPayload {
  id: string;
  category: "reminder";
  alertId: string;
  reminderId: string;
  recordId: string;
  recordTitle: string;
  title: string;
  body: string;
  dueAt: string;
  triggerAt: string;
  actions: TerminalReminderNotificationActionButton[];
}

export interface TerminalNotificationShown {
  notificationId: string;
  shownAt: string;
}

export interface TerminalNotificationAdapter {
  requestPermission(): Promise<TerminalNotificationPermission>;
  showReminder(payload: TerminalReminderNotificationPayload): Promise<TerminalNotificationShown>;
  cancel?(notificationId: string): Promise<void>;
}

export type TerminalReminderNotificationDispatchStatus =
  | "shown"
  | "permission-denied"
  | "permission-prompt"
  | "unsupported";

export interface TerminalReminderNotificationDispatch {
  alertId: string;
  recordId: string;
  reminderId: string;
  status: TerminalReminderNotificationDispatchStatus;
  requestedAt: string;
  permissionStatus: TerminalNotificationPermissionStatus;
  notificationId?: string;
  shownAt?: string;
}

export interface DeliverTerminalReminderNotificationsInput {
  adapter: TerminalNotificationAdapter;
  deliveries: readonly ReminderNotificationDelivery[];
  now?: Clock;
  onDelivered?: (delivery: ReminderNotificationDelivery, shown: TerminalNotificationShown) => void | Promise<void>;
}

export interface TerminalReminderNotificationActionRequest {
  action: TerminalReminderNotificationAction;
  alertId: string;
  recordId: string;
  reminderId: string;
  requestedAt: string;
  notificationId?: string;
  snoozedUntil?: string;
}

const defaultActions: TerminalReminderNotificationActionButton[] = [
  { id: "open", label: "查看" },
  { id: "snooze", label: "稍后提醒" },
  { id: "complete", label: "完成" },
  { id: "dismiss", label: "忽略" }
];

export function createTerminalReminderNotificationPayload(
  delivery: ReminderNotificationDelivery
): TerminalReminderNotificationPayload {
  assertReminderDeliveryForTerminal(delivery);
  return {
    id: delivery.alertId,
    category: "reminder",
    alertId: delivery.alertId,
    reminderId: delivery.reminderId,
    recordId: delivery.recordId,
    recordTitle: delivery.recordTitle,
    title: delivery.title,
    body: delivery.message,
    dueAt: delivery.dueAt,
    triggerAt: delivery.triggerAt,
    actions: defaultActions.map((action) => ({ ...action }))
  };
}

export async function deliverTerminalReminderNotifications(
  input: DeliverTerminalReminderNotificationsInput
): Promise<TerminalReminderNotificationDispatch[]> {
  const now = input.now ?? systemClock;
  const requestedAt = now();
  assertIsoDateTime(requestedAt, "requestedAt");
  const pendingDeliveries = input.deliveries.filter((delivery) => delivery.status === "pending");
  if (pendingDeliveries.length === 0) {
    return [];
  }

  const permission = await input.adapter.requestPermission();
  assertTerminalNotificationPermission(permission);
  if (permission.status !== "granted") {
    const status = mapPermissionToDispatchStatus(permission.status);
    return pendingDeliveries.map((delivery) => ({
      alertId: delivery.alertId,
      recordId: delivery.recordId,
      reminderId: delivery.reminderId,
      status,
      requestedAt,
      permissionStatus: permission.status
    }));
  }

  const dispatches: TerminalReminderNotificationDispatch[] = [];
  for (const delivery of pendingDeliveries) {
    const payload = createTerminalReminderNotificationPayload(delivery);
    const shown = await input.adapter.showReminder(payload);
    assertTerminalNotificationShown(shown);
    await input.onDelivered?.(delivery, shown);
    dispatches.push({
      alertId: delivery.alertId,
      recordId: delivery.recordId,
      reminderId: delivery.reminderId,
      status: "shown",
      requestedAt,
      permissionStatus: permission.status,
      notificationId: shown.notificationId,
      shownAt: shown.shownAt
    });
  }
  return dispatches;
}

export function createTerminalReminderNotificationActionRequest(input: {
  action: TerminalReminderNotificationAction;
  delivery: Pick<ReminderNotificationDelivery, "alertId" | "recordId" | "reminderId">;
  requestedAt?: string;
  notificationId?: string;
  snoozedUntil?: string;
}): TerminalReminderNotificationActionRequest {
  assertTerminalReminderNotificationAction(input.action);
  const requestedAt = input.requestedAt ?? systemClock();
  assertIsoDateTime(requestedAt, "requestedAt");
  assertNonEmpty(input.delivery.alertId, "alertId");
  assertNonEmpty(input.delivery.recordId, "recordId");
  assertNonEmpty(input.delivery.reminderId, "reminderId");
  if (input.notificationId) {
    assertNonEmpty(input.notificationId, "notificationId");
  }
  if (input.snoozedUntil) {
    assertIsoDateTime(input.snoozedUntil, "snoozedUntil");
  }

  return {
    action: input.action,
    alertId: input.delivery.alertId,
    recordId: input.delivery.recordId,
    reminderId: input.delivery.reminderId,
    requestedAt,
    notificationId: input.notificationId,
    snoozedUntil: input.snoozedUntil
  };
}

function assertReminderDeliveryForTerminal(delivery: ReminderNotificationDelivery): void {
  for (const key of ["alertId", "reminderId", "recordId", "recordTitle", "title", "message"] as const) {
    assertNonEmpty(delivery[key], key);
  }
  assertIsoDateTime(delivery.dueAt, "dueAt");
  assertIsoDateTime(delivery.triggerAt, "triggerAt");
}

function assertTerminalNotificationPermission(permission: TerminalNotificationPermission): void {
  if (!["granted", "denied", "prompt", "unsupported"].includes(permission.status)) {
    throw new Error(`Unsupported terminal notification permission status: ${permission.status}`);
  }
  if (typeof permission.canAskAgain !== "boolean") {
    throw new Error("Terminal notification permission canAskAgain must be boolean");
  }
}

function assertTerminalNotificationShown(shown: TerminalNotificationShown): void {
  assertNonEmpty(shown.notificationId, "notificationId");
  assertIsoDateTime(shown.shownAt, "shownAt");
}

function assertIsoDateTime(value: string, label: string): void {
  if (!isIsoDateTime(value)) {
    throw new Error(`${label} must be an ISO date-time string`);
  }
}

function assertTerminalReminderNotificationAction(action: string): asserts action is TerminalReminderNotificationAction {
  if (!["open", "snooze", "complete", "dismiss"].includes(action)) {
    throw new Error(`Unsupported terminal reminder notification action: ${action}`);
  }
}

function mapPermissionToDispatchStatus(
  status: TerminalNotificationPermissionStatus
): TerminalReminderNotificationDispatchStatus {
  if (status === "denied") {
    return "permission-denied";
  }
  if (status === "unsupported") {
    return "unsupported";
  }
  return "permission-prompt";
}
