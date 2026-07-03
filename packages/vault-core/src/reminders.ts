import type { ReminderRepeat, ReminderRule, ReminderStatus } from "./index.ts";
import { defaultIdFactory, isIsoDateTime, systemClock, type Clock, type IdFactory } from "./utils.ts";

export interface CreateReminderRuleInput {
  recordId: string;
  dueAt: string;
  message: string;
  daysBefore?: number;
  repeat?: ReminderRepeat;
  status?: ReminderStatus;
  id?: string;
  now?: Clock;
  ids?: IdFactory;
}

export function createReminderRule(input: CreateReminderRuleInput): ReminderRule {
  if (!isIsoDateTime(input.dueAt)) {
    throw new Error("Reminder dueAt must be an ISO date-time string");
  }
  if (!input.message.trim()) {
    throw new Error("Reminder message must not be empty");
  }

  const ids = input.ids ?? defaultIdFactory;
  return {
    id: input.id ?? ids.nextId("reminder"),
    recordId: input.recordId,
    dueAt: input.dueAt,
    message: input.message.trim(),
    daysBefore: input.daysBefore ?? 7,
    repeat: input.repeat ?? "none",
    status: input.status ?? "scheduled"
  };
}

export function snoozeReminder(reminder: ReminderRule, snoozedUntil: string): ReminderRule {
  if (!isIsoDateTime(snoozedUntil)) {
    throw new Error("snoozedUntil must be an ISO date-time string");
  }
  return {
    ...reminder,
    status: "snoozed",
    snoozedUntil
  };
}

export function completeReminder(reminder: ReminderRule, now: Clock = systemClock): ReminderRule {
  return {
    ...reminder,
    status: "done",
    completedAt: now()
  };
}
