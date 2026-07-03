import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const appState = await import("../apps/mobile/scripts/app-state.mjs");
const captureSession = await import("../apps/mobile/scripts/capture-session.mjs");

const root = process.cwd();
const captureDir = join(root, ".tmp", "mobile-camera-capture-session");
const captureLogPath = join(root, ".tmp", "mobile-camera-capture-session.jsonl");

await rm(captureDir, { recursive: true, force: true });
await rm(captureLogPath, { force: true });

const started = await appState.startMobileShellCameraCapture({
  captureDir,
  captureLogPath,
  capturedAt: "2026-06-13T09:41:00.000Z",
  rawText: [
    "Studio Plus",
    "会员号 SP-2026",
    "到期 2026-12-31",
    "客服电话 400-555-0145"
  ].join("\n")
});

if (!started.ok || started.session.status !== "captured") {
  throw new Error("Expected mobile camera capture session to start");
}
if (started.session.writeVerified !== true) {
  throw new Error("Expected mobile camera capture session to verify the encrypted blob before commit");
}

const blobInfo = await stat(started.session.encryptedBlobPath);
if (!blobInfo.isFile() || blobInfo.size <= 0) {
  throw new Error("Expected encrypted capture blob to be written");
}
let tempBlobExists = true;
try {
  await stat(`${started.session.encryptedBlobPath}.tmp`);
} catch (error) {
  if (error?.code === "ENOENT") {
    tempBlobExists = false;
  } else {
    throw error;
  }
}
if (tempBlobExists) {
  throw new Error("Expected encrypted capture blob temp file to be removed after atomic commit");
}

const sessions = await captureSession.readMobileCaptureSessions({ captureLogPath });
if (sessions.length !== 1 || sessions[0].imageAttachmentId !== started.session.imageAttachmentId) {
  throw new Error("Expected capture session log to keep the latest image attachment id");
}

const blobJson = await readFile(started.session.encryptedBlobPath, "utf8");
if (!blobJson.includes("cipher") || !blobJson.includes("digestSha256Base64")) {
  throw new Error("Expected encrypted capture blob JSON to contain cipher metadata");
}

const committed = await appState.commitMobileShellOcrDraft({
  captureLogPath,
  acceptedType: "membership",
  acceptedFieldKeys: ["member_name", "member_id", "expires_at", "service_phone"],
  createReminder: true,
  decidedAt: "2026-06-13T09:43:00.000Z"
});

if (!committed.ok || committed.record.attachments !== 1) {
  throw new Error("Expected OCR commit to create a record with one encrypted attachment");
}
if (committed.record.reminders !== 1) {
  throw new Error("Expected OCR commit to create a reminder from the captured membership date");
}
if (!committed.record.attachmentNames.includes(started.session.encryptedBlobPath)) {
  throw new Error("Expected committed OCR record to reference the captured encrypted blob path");
}

console.log("Mobile camera capture session smoke test passed.");
console.log(
  JSON.stringify(
    {
      sessionId: started.session.id,
      imageAttachmentId: started.session.imageAttachmentId,
      encryptedBlobPath: started.session.encryptedBlobPath,
      encryptedBlobBytes: blobInfo.size,
      writeVerified: started.session.writeVerified,
      recordId: committed.record.id,
      reminders: committed.record.reminders
    },
    null,
    2
  )
);
