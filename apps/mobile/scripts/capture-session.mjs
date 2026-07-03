import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const crypto = await import("../../../packages/crypto-core/src/index.ts");
const encryptedCapture = await import("../src/encrypted-capture.ts");

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = normalize(join(__dirname, "..", "..", ".."));
const defaultCaptureDir = join(workspaceRoot, ".tmp", "mobile-captures");
const defaultCaptureLogPath = join(workspaceRoot, ".tmp", "mobile-capture-sessions.jsonl");
const fixedSaltBase64 = Buffer.alloc(16).toString("base64");
const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_capture_${Date.now().toString(36)}_${this.value}`;
  }
};

export async function createMobileCameraCaptureSession(input = {}) {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const mimeType = input.mimeType ?? "image/jpeg";
  const source = input.source ?? "camera";
  const rawText = input.rawText ?? [
    "Airport Lounge VIP",
    "Member ID LOUNGE-2026",
    "Expires 2026-11-26",
    "Service phone 400-555-0101"
  ].join("\n");
  const plaintext = input.plaintextBase64
    ? Buffer.from(input.plaintextBase64, "base64")
    : Buffer.from(`LoginTo simulated camera frame\n${rawText}\n${capturedAt}`, "utf8");

  const adapter = crypto.createWebCryptoAesGcmAdapter();
  const key = await adapter.deriveKey(input.password ?? "mobile-shell-preview-password", {
    ...crypto.DEFAULT_WEB_CRYPTO_KDF_PARAMS,
    iterations: input.kdfIterations ?? 20_000,
    saltBase64: input.saltBase64 ?? fixedSaltBase64
  });
  const imageAttachmentId = input.imageAttachmentId ?? ids.nextId("attachment");
  const encryptedBlobPath = join(getMobileCaptureDir(input), `${imageAttachmentId}.blob.json`);
  const prepared = await encryptedCapture.prepareMobileEncryptedCapture({
    adapter,
    key,
    plaintext,
    mimeType,
    source,
    encryptedBlobPath,
    imageAttachmentId,
    aadPrefix: "mobile-shell-capture-session",
    ids
  });

  const writeResult = await writeEncryptedCaptureBlobAtomically(encryptedBlobPath, prepared);

  const session = {
    id: ids.nextId("capture_session"),
    capturedAt,
    status: "captured",
    source,
    rawText,
    imageAttachmentId: prepared.imageAttachmentId,
    image: prepared.image,
    encryptedBlobPath,
    encryptedBlobBytes: writeResult.bytes,
    writeVerified: true
  };
  await appendCaptureLog(input.captureLogPath, session);
  return session;
}

export async function readMobileCaptureSessions(input = {}) {
  const captureLogPath = input.captureLogPath ?? getMobileCaptureLogPath();
  try {
    const text = await readFile(captureLogPath, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function getMobileCaptureDir(input = {}) {
  return input.captureDir ?? process.env.LOGINTO_MOBILE_CAPTURE_DIR ?? defaultCaptureDir;
}

export function getMobileCaptureLogPath() {
  return process.env.LOGINTO_MOBILE_CAPTURE_LOG_PATH || defaultCaptureLogPath;
}

async function appendCaptureLog(path, session) {
  const captureLogPath = path ?? getMobileCaptureLogPath();
  await mkdir(dirname(captureLogPath), { recursive: true });
  await appendFile(captureLogPath, `${JSON.stringify(session)}\n`, "utf8");
}

async function writeEncryptedCaptureBlobAtomically(encryptedBlobPath, prepared) {
  await mkdir(dirname(encryptedBlobPath), { recursive: true });
  const tempPath = `${encryptedBlobPath}.tmp`;
  try {
    await writeFile(tempPath, prepared.encryptedBlobJson, "utf8");
    const written = await readFile(tempPath, "utf8");
    const parsed = crypto.parseEncryptedAttachmentBlob(written);
    if (parsed.digestSha256Base64 !== prepared.image.digest) {
      throw new Error("Encrypted capture blob digest mismatch before commit");
    }
    if (parsed.encryptedSize !== prepared.image.encryptedSize) {
      throw new Error("Encrypted capture blob size mismatch before commit");
    }
    await rename(tempPath, encryptedBlobPath);
    return {
      bytes: Buffer.byteLength(written, "utf8")
    };
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}
