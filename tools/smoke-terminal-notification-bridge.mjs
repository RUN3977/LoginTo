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
  title: "Airport Lounge VIP",
  values: {
    member_name: "Airport Lounge VIP",
    member_id: "LOUNGE-2026",
    expires_at: "2026-12-31T00:00:00.000Z"
  },
  reminderDrafts: [
    {
      dueAt: "2026-12-31T00:00:00.000Z",
      message: "Airport Lounge VIP membership expires soon",
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

const center = new vault.ReminderNotificationCenter([], () => "2026-12-24T09:00:00.000Z");
const due = center.collectDue([record], "2026-12-24T09:00:00.000Z");
if (due.length !== 1 || due[0].status !== "pending") {
  throw new Error("Expected one pending reminder delivery for terminal notification bridge");
}

const shownPayloads = [];
const grantedAdapter = {
  async requestPermission() {
    return { status: "granted", canAskAgain: true };
  },
  async showReminder(payload) {
    shownPayloads.push(payload);
    return {
      notificationId: `system_${payload.alertId}`,
      shownAt: "2026-12-24T09:01:00.000Z"
    };
  }
};

const dispatches = await vault.deliverTerminalReminderNotifications({
  adapter: grantedAdapter,
  deliveries: due,
  now: () => "2026-12-24T09:00:30.000Z",
  onDelivered(delivery, shown) {
    center.markDelivered(delivery.alertId, shown.shownAt);
  }
});

if (dispatches.length !== 1 || dispatches[0].status !== "shown") {
  throw new Error("Expected terminal notification bridge to show the pending reminder");
}
if (center.list()[0].status !== "delivered") {
  throw new Error("Expected terminal notification bridge onDelivered callback to mark delivery");
}
const payload = shownPayloads[0];
if (
  payload.category !== "reminder"
  || payload.title !== due[0].title
  || payload.body !== due[0].message
  || payload.recordId !== due[0].recordId
  || !payload.actions.some((action) => action.id === "snooze")
  || !payload.actions.some((action) => action.id === "complete")
) {
  throw new Error("Expected terminal reminder payload to preserve record context and actions");
}

const deniedAdapter = {
  async requestPermission() {
    return { status: "denied", canAskAgain: false };
  },
  async showReminder() {
    throw new Error("showReminder should not be called when permission is denied");
  }
};

const deniedDispatches = await vault.deliverTerminalReminderNotifications({
  adapter: deniedAdapter,
  deliveries: due,
  now: () => "2026-12-24T09:02:00.000Z"
});
if (deniedDispatches.length !== 1 || deniedDispatches[0].status !== "permission-denied") {
  throw new Error("Expected terminal notification bridge to report denied permission");
}

const snoozeRequest = vault.createTerminalReminderNotificationActionRequest({
  action: "snooze",
  delivery: due[0],
  notificationId: dispatches[0].notificationId,
  requestedAt: "2026-12-24T09:03:00.000Z",
  snoozedUntil: "2026-12-24T10:03:00.000Z"
});
if (snoozeRequest.action !== "snooze" || snoozeRequest.alertId !== due[0].alertId) {
  throw new Error("Expected terminal notification action request to keep alert identity");
}

console.log("Terminal notification bridge smoke test passed.");
console.log(
  JSON.stringify(
    {
      alertId: due[0].alertId,
      dispatchStatus: dispatches[0].status,
      deniedStatus: deniedDispatches[0].status,
      actions: payload.actions.map((action) => action.id),
      actionRequest: snoozeRequest.action
    },
    null,
    2
  )
);
