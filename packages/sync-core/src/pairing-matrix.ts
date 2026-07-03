import qrcode from "qrcode-generator";
import type { PairingPayload } from "./index.ts";

export interface PairingMatrix {
  format: "loginto-pairing-matrix-v1";
  size: number;
  cells: boolean[];
  payloadText: string;
}

export interface PairingQrCode {
  format: "loginto-pairing-qr-v1";
  standard: "qr-code";
  errorCorrectionLevel: "M";
  size: number;
  cells: boolean[];
  payloadText: string;
  svg: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodePairingPayloadMatrix(payload: PairingPayload): PairingMatrix {
  assertPairingPayload(payload);
  const payloadText = encodePairingPayloadText(payload);
  const bytes = textEncoder.encode(payloadText);
  const bitLength = bytes.length * 8;
  const headerBits = 16;
  const size = Math.ceil(Math.sqrt(headerBits + bitLength));
  const cells = Array.from({ length: size * size }, () => false);
  writeNumberBits(cells, 0, bitLength, headerBits);
  let offset = headerBits;
  for (const byte of bytes) {
    writeNumberBits(cells, offset, byte, 8);
    offset += 8;
  }
  return {
    format: "loginto-pairing-matrix-v1",
    size,
    cells,
    payloadText
  };
}

export function encodePairingPayloadQr(payload: PairingPayload): PairingQrCode {
  assertPairingPayload(payload);
  const payloadText = encodePairingPayloadText(payload);
  const qr = qrcode(0, "M");
  qr.addData(payloadText);
  qr.make();
  const size = qr.getModuleCount();
  const cells: boolean[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      cells.push(qr.isDark(row, column));
    }
  }
  return {
    format: "loginto-pairing-qr-v1",
    standard: "qr-code",
    errorCorrectionLevel: "M",
    size,
    cells,
    payloadText,
    svg: qr.createSvgTag(3, 4)
  };
}

export function decodePairingPayloadMatrix(matrix: Pick<PairingMatrix, "size" | "cells">): PairingPayload {
  if (!Number.isInteger(matrix.size) || matrix.size < 8) {
    throw new Error(`Invalid pairing matrix size: ${matrix.size}`);
  }
  if (!Array.isArray(matrix.cells) || matrix.cells.length !== matrix.size * matrix.size) {
    throw new Error("Pairing matrix cells must match size squared");
  }
  const bitLength = readNumberBits(matrix.cells, 0, 16);
  if (bitLength <= 0 || bitLength % 8 !== 0 || bitLength > matrix.cells.length - 16) {
    throw new Error("Pairing matrix payload length is invalid");
  }
  const bytes = [];
  for (let offset = 16; offset < 16 + bitLength; offset += 8) {
    bytes.push(readNumberBits(matrix.cells, offset, 8));
  }
  const payloadText = textDecoder.decode(new Uint8Array(bytes));
  return decodePairingPayloadText(payloadText);
}

export function decodePairingPayloadText(payloadText: string): PairingPayload {
  const payload = JSON.parse(decodeBase64Url(payloadText)) as PairingPayload;
  assertPairingPayloadLike(payload);
  return payload;
}

export function encodePairingPayloadText(payload: PairingPayload): string {
  assertPairingPayload(payload);
  return encodeBase64Url(JSON.stringify(payload));
}

function assertPairingPayload(payload: PairingPayload): void {
  assertPairingPayloadLike(payload);
}

function assertPairingPayloadLike(payload: PairingPayload): void {
  if (payload.protocol !== "loginto-pairing-v1") {
    throw new Error(`Unsupported pairing payload protocol: ${payload.protocol}`);
  }
  if (!payload.sessionId?.trim()) {
    throw new Error("Pairing payload session id must not be empty");
  }
  if (!payload.publicKeyBase64?.trim()) {
    throw new Error("Pairing payload public key must not be empty");
  }
  if (!payload.expiresAt?.includes("T") || !Number.isFinite(Date.parse(payload.expiresAt))) {
    throw new Error("Pairing payload expiresAt must be an ISO date-time string");
  }
  if (!payload.device?.id?.trim() || !payload.device.name?.trim() || !payload.device.publicKeyBase64?.trim()) {
    throw new Error("Pairing payload device identity is invalid");
  }
  if (payload.device.kind !== "phone" && payload.device.kind !== "tablet" && payload.device.kind !== "desktop" && payload.device.kind !== "backup") {
    throw new Error(`Unsupported pairing payload device kind: ${payload.device.kind}`);
  }
}

function writeNumberBits(cells: boolean[], offset: number, value: number, bitCount: number): void {
  for (let index = 0; index < bitCount; index += 1) {
    const shift = bitCount - index - 1;
    cells[offset + index] = Boolean((value >> shift) & 1);
  }
}

function readNumberBits(cells: readonly boolean[], offset: number, bitCount: number): number {
  let value = 0;
  for (let index = 0; index < bitCount; index += 1) {
    value = (value << 1) | (cells[offset + index] ? 1 : 0);
  }
  return value;
}

function encodeBase64Url(text: string): string {
  return btoaUtf8(text)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(text: string): string {
  const padded = `${text}${"=".repeat((4 - (text.length % 4)) % 4)}`
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  return atobUtf8(padded);
}

function btoaUtf8(text: string): string {
  let binary = "";
  for (const byte of textEncoder.encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function atobUtf8(base64: string): string {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return textDecoder.decode(bytes);
}
