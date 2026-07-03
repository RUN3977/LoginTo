import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const identityFiles = [
  "identity-keys-desktop.device-identity.json",
  "identity-keys-mobile.device-identity.json",
  "identity-keys-tablet.device-identity.json"
].map((name) => join(root, ".tmp", name));

const stateFiles = [
  "identity-keys-desktop.vault-snapshot.json",
  "identity-keys-mobile.vault-snapshot.json",
  "identity-keys-tablet.vault-snapshot.json",
  "identity-keys-desktop.runtime-state.json",
  "identity-keys-mobile.runtime-state.json",
  "identity-keys-tablet.runtime-state.json",
  ...identityFiles.map((file) => file.slice(file.lastIndexOf("\\") + 1))
].map((name) => name.includes(":") || name.startsWith(root) ? name : join(root, ".tmp", name));

for (const file of stateFiles) {
  await rm(file, { force: true });
  await rm(`${file}.tmp`, { force: true });
}

delete process.env.LOGINTO_SHARED_TERMINAL_VAULT_PATH;
process.env.LOGINTO_DESKTOP_SHELL_VAULT_PATH = join(root, ".tmp", "identity-keys-desktop.vault-snapshot.json");
process.env.LOGINTO_MOBILE_SHELL_VAULT_PATH = join(root, ".tmp", "identity-keys-mobile.vault-snapshot.json");
process.env.LOGINTO_TABLET_SHELL_VAULT_PATH = join(root, ".tmp", "identity-keys-tablet.vault-snapshot.json");
process.env.LOGINTO_DESKTOP_SHELL_RUNTIME_STATE_PATH = join(root, ".tmp", "identity-keys-desktop.runtime-state.json");
process.env.LOGINTO_MOBILE_SHELL_RUNTIME_STATE_PATH = join(root, ".tmp", "identity-keys-mobile.runtime-state.json");
process.env.LOGINTO_TABLET_SHELL_RUNTIME_STATE_PATH = join(root, ".tmp", "identity-keys-tablet.runtime-state.json");
process.env.LOGINTO_DESKTOP_DEVICE_IDENTITY_PATH = identityFiles[0];
process.env.LOGINTO_MOBILE_DEVICE_IDENTITY_PATH = identityFiles[1];
process.env.LOGINTO_TABLET_DEVICE_IDENTITY_PATH = identityFiles[2];

const desktop = await import("../apps/desktop/scripts/dev-server.mjs");
const mobile = await import("../apps/mobile/scripts/dev-server.mjs");
const tablet = await import("../apps/tablet/scripts/dev-server.mjs");

const servers = [
  { key: "desktop", kind: "desktop", file: identityFiles[0], server: desktop.createDesktopShellServer() },
  { key: "mobile", kind: "phone", file: identityFiles[1], server: mobile.createMobileShellServer() },
  { key: "tablet", kind: "tablet", file: identityFiles[2], server: tablet.createTabletShellServer() }
];

try {
  await Promise.all(servers.map((item) => listen(item.server)));
  const summaries = [];
  for (const item of servers) {
    const summary = await getJson(`${createBaseUrl(item.server)}/api/sync/summary`);
    const persisted = JSON.parse(await readFile(item.file, "utf8"));
    if (summary.device.kind !== item.kind) {
      throw new Error(`Expected ${item.key} device kind ${item.kind}, got ${summary.device.kind}`);
    }
    if (!summary.device.id || !summary.device.name || !summary.device.publicKeyBase64) {
      throw new Error(`Expected ${item.key} summary to expose full local device identity`);
    }
    if (persisted.publicKeyBase64 !== summary.device.publicKeyBase64) {
      throw new Error(`Expected ${item.key} local public key to be persisted`);
    }
    summaries.push(summary.device);
  }

  const legacyKeys = new Set([
    "desktop-shell-public-key",
    "mobile-shell-public-key",
    "tablet-shell-public-key"
  ]);
  const publicKeys = summaries.map((device) => device.publicKeyBase64);
  if (new Set(publicKeys).size !== publicKeys.length) {
    throw new Error("Expected each terminal to generate a unique local public key");
  }
  for (const key of publicKeys) {
    if (legacyKeys.has(key)) {
      throw new Error(`Expected generated local public key, got legacy fixed key: ${key}`);
    }
  }

  console.log("Device identity unique key smoke test passed.");
  console.log(JSON.stringify(Object.fromEntries(summaries.map((device) => [
    device.kind,
    {
      id: device.id,
      name: device.name,
      publicKeyBytes: Buffer.from(device.publicKeyBase64, "base64").byteLength
    }
  ])), null, 2));
} finally {
  await Promise.all(servers.map((item) => closeServer(item.server)));
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function createBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
