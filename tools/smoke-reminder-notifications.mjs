const vault = await import("../packages/vault-core/src/index.ts");
const crypto = await import("../packages/crypto-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

function createMembershipRecord(title, dueAt, message) {
  const draft = vault.createRecordDraft({
    type: "membership",
    title,
    values: {
      member_name: title,
      member_id: `${title.toUpperCase().replace(/[^A-Z0-9]/g, "-")}-2026`,
      expires_at: dueAt
    },
    reminderDrafts: [
      {
        dueAt,
        message,
        daysBefore: 7
      }
    ]
  });

  return vault.createVaultRecord({
    draft,
    encryptFieldValue: crypto.createUnsafeDevelopmentFieldEncryptor(),
    now: () => "2026-06-01T00:00:00.000Z",
    ids
  });
}

const record = createMembershipRecord(
  "Airport Lounge",
  "2026-07-01T00:00:00.000Z",
  "Airport Lounge membership expires soon"
);
const center = new vault.ReminderNotificationCenter([], () => "2026-06-24T00:00:00.000Z");

const firstDue = center.collectDue([record], "2026-06-24T00:00:00.000Z");
if (firstDue.length !== 1 || firstDue[0].status !== "pending") {
  throw new Error("Expected one pending reminder notification");
}

const repeatedPending = center.collectDue([record], "2026-06-24T00:01:00.000Z");
if (repeatedPending.length !== 1 || repeatedPending[0].alertId !== firstDue[0].alertId) {
  throw new Error("Expected pending notification to be stable before delivery");
}

center.markDelivered(firstDue[0].alertId, "2026-06-24T00:02:00.000Z");
const afterDelivered = center.collectDue([record], "2026-06-24T00:03:00.000Z");
if (afterDelivered.length !== 0) {
  throw new Error("Expected delivered notification to be deduplicated");
}

center.snooze(
  firstDue[0].alertId,
  "2026-06-24T01:00:00.000Z",
  "2026-06-24T00:04:00.000Z"
);
const beforeSnooze = center.collectDue([record], "2026-06-24T00:30:00.000Z");
if (beforeSnooze.length !== 0) {
  throw new Error("Expected snoozed notification to stay quiet before snoozedUntil");
}

const afterSnooze = center.collectDue([record], "2026-06-24T01:00:00.000Z");
if (afterSnooze.length !== 1 || afterSnooze[0].status !== "pending") {
  throw new Error("Expected snoozed notification to become pending again");
}

center.complete(firstDue[0].alertId, "2026-06-24T01:05:00.000Z");
const afterComplete = center.collectDue([record], "2026-06-24T02:00:00.000Z");
if (afterComplete.length !== 0) {
  throw new Error("Expected completed notification to stay quiet");
}

const dismissRecord = createMembershipRecord(
  "Gym Club",
  "2026-08-01T00:00:00.000Z",
  "Gym membership expires soon"
);
const dismissCenter = new vault.ReminderNotificationCenter();
const dismissDue = dismissCenter.collectDue([dismissRecord], "2026-07-25T00:00:00.000Z");
dismissCenter.dismiss(dismissDue[0].alertId, "2026-07-25T00:05:00.000Z");
const afterDismiss = dismissCenter.collectDue([dismissRecord], "2026-07-25T01:00:00.000Z");
if (afterDismiss.length !== 0) {
  throw new Error("Expected dismissed notification to stay quiet");
}

console.log("Reminder notification center smoke test passed.");
console.log(
  JSON.stringify(
    {
      alertId: firstDue[0].alertId,
      firstDue: firstDue.length,
      afterDelivered: afterDelivered.length,
      afterSnooze: afterSnooze.length,
      finalStatus: center.list()[0].status,
      dismissedStatus: dismissCenter.list()[0].status
    },
    null,
    2
  )
);
