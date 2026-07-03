const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const draft = vault.createRecordDraft({
  type: "membership",
  title: "Gym Membership",
  values: {
    member_name: "Gym",
    member_id: "GYM-2026",
    expires_at: "2026-07-01T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-07-01T00:00:00.000Z",
      message: "Gym membership expires soon",
      daysBefore: 7
    }
  ]
});

const record = vault.createVaultRecord({
  draft,
  encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
  now: () => "2026-06-01T00:00:00.000Z",
  ids
});

const triggerAt = vault.getReminderTriggerAt(record.reminders[0]);
if (triggerAt !== "2026-06-24T00:00:00.000Z") {
  throw new Error(`Expected triggerAt 2026-06-24, got ${triggerAt}`);
}

const dueAlerts = vault.getDueReminderAlerts([record], "2026-06-24T00:00:00.000Z");
if (dueAlerts.length !== 1) {
  throw new Error(`Expected 1 due alert, got ${dueAlerts.length}`);
}

const upcoming = vault.getUpcomingReminderAlerts([record], "2026-06-01T00:00:00.000Z", 30);
if (upcoming.length !== 1) {
  throw new Error(`Expected 1 upcoming alert, got ${upcoming.length}`);
}

if (!dueAlerts[0].body.includes("2026-07-01")) {
  throw new Error("Expected alert body to include due date");
}

console.log("Reminder engine smoke test passed.");
console.log(
  JSON.stringify(
    {
      triggerAt,
      dueAlerts: dueAlerts.length,
      upcoming: upcoming.length,
      title: dueAlerts[0].title
    },
    null,
    2
  )
);
