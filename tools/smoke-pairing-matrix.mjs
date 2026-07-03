const sync = await import("../packages/sync-core/src/index.ts");

const ids = {
  value: 0,
  nextId(prefix) {
    this.value += 1;
    return `${prefix}_${this.value}`;
  }
};

const now = () => "2026-06-10T10:00:00.000Z";

const phoneDevice = sync.createDeviceIdentity({
  id: "device_phone_matrix",
  name: "Phone Matrix",
  kind: "phone",
  publicKeyBase64: "phone-matrix-key",
  now,
  ids
});

const payload = sync.createPairingPayload({
  device: phoneDevice,
  localEndpoint: "http://127.0.0.1:43111",
  ttlSeconds: 300,
  now,
  ids
});

const matrix = sync.encodePairingPayloadMatrix(payload);
const decoded = sync.decodePairingPayloadMatrix(matrix);
const qr = sync.encodePairingPayloadQr(payload);
const decodedFromQrText = sync.decodePairingPayloadText(qr.payloadText);

if (matrix.format !== "loginto-pairing-matrix-v1") {
  throw new Error(`Unexpected pairing matrix format: ${matrix.format}`);
}

if (matrix.cells.length !== matrix.size * matrix.size || matrix.size <= 7) {
  throw new Error("Expected pairing matrix cells to match a dynamic square size");
}

if (decoded.sessionId !== payload.sessionId || decoded.device.id !== phoneDevice.id || decoded.localEndpoint !== payload.localEndpoint) {
  throw new Error("Expected pairing matrix decode to restore the original payload");
}

if (qr.format !== "loginto-pairing-qr-v1" || qr.standard !== "qr-code" || qr.errorCorrectionLevel !== "M") {
  throw new Error(`Unexpected pairing QR metadata: ${qr.format}`);
}

if (qr.cells.length !== qr.size * qr.size || qr.size <= 20 || !qr.svg.includes("<svg")) {
  throw new Error("Expected standard pairing QR to expose module cells and SVG markup");
}

if (decodedFromQrText.sessionId !== payload.sessionId || decodedFromQrText.device.id !== phoneDevice.id) {
  throw new Error("Expected pairing QR payload text to restore the original payload");
}

console.log("Pairing matrix smoke test passed.");
console.log(
  JSON.stringify(
    {
      format: matrix.format,
      size: matrix.size,
      cells: matrix.cells.length,
      qrFormat: qr.format,
      qrSize: qr.size,
      payloadTextLength: matrix.payloadText.length,
      decodedDevice: decoded.device.id
    },
    null,
    2
  )
);
