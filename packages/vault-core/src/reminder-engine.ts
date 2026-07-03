import type { ReminderRule, VaultRecord } from "./index.ts";

export interface ReminderAlert {
  id: string;
  recordId: string;
  recordTitle: string;
  title: string;
  body: string;
  dueAt: string;
  triggerAt: string;
  status: ReminderRule["status"];
}

export function getReminderTriggerAt(reminder: ReminderRule): string {
  const dueTime = Date.parse(reminder.dueAt);
  if (!Number.isFinite(dueTime)) {
    throw new Error(`Invalid reminder dueAt: ${reminder.dueAt}`);
  }
  const triggerTime = dueTime - reminder.daysBefore * 24 * 60 * 60 * 1000;
  return new Date(triggerTime).toISOString();
}

export function getDueReminderAlerts(records: readonly VaultRecord[], now: string): ReminderAlert[] {
  const nowTime = Date.parse(now);
  if (!Number.isFinite(nowTime)) {
    throw new Error(`Invalid now value: ${now}`);
  }

  return records
    .flatMap((record) =>
      record.reminders
        .filter((reminder) => shouldAlertReminder(reminder, nowTime))
        .map((reminder) => createReminderAlert(record, reminder))
    )
    .sort((a, b) => a.triggerAt.localeCompare(b.triggerAt));
}

export function getUpcomingReminderAlerts(
  records: readonly VaultRecord[],
  now: string,
  withinDays = 30
): ReminderAlert[] {
  const nowTime = Date.parse(now);
  if (!Number.isFinite(nowTime)) {
    throw new Error(`Invalid now value: ${now}`);
  }
  const maxTime = nowTime + withinDays * 24 * 60 * 60 * 1000;

  return records
    .flatMap((record) =>
      record.reminders
        .filter((reminder) => reminder.status === "scheduled" || reminder.status === "snoozed")
        .filter((reminder) => {
          const triggerTime = Date.parse(reminder.status === "snoozed" ? reminder.snoozedUntil ?? reminder.dueAt : getReminderTriggerAt(reminder));
          return triggerTime >= nowTime && triggerTime <= maxTime;
        })
        .map((reminder) => createReminderAlert(record, reminder))
    )
    .sort((a, b) => a.triggerAt.localeCompare(b.triggerAt));
}

export function createReminderAlert(record: VaultRecord, reminder: ReminderRule): ReminderAlert {
  const triggerAt = reminder.status === "snoozed" && reminder.snoozedUntil
    ? reminder.snoozedUntil
    : getReminderTriggerAt(reminder);
  return {
    id: reminder.id,
    recordId: record.id,
    recordTitle: record.title,
    title: `${record.title} 提醒`,
    body: `${reminder.message} 到期时间：${formatDateForAlert(reminder.dueAt)}`,
    dueAt: reminder.dueAt,
    triggerAt,
    status: reminder.status
  };
}

function shouldAlertReminder(reminder: ReminderRule, nowTime: number): boolean {
  if (reminder.status === "disabled" || reminder.status === "done") {
    return false;
  }

  if (reminder.status === "snoozed") {
    return Boolean(reminder.snoozedUntil && Date.parse(reminder.snoozedUntil) <= nowTime);
  }

  return Date.parse(getReminderTriggerAt(reminder)) <= nowTime;
}

function formatDateForAlert(value: string): string {
  return value.slice(0, 10);
}
