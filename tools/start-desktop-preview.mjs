import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const nodePath = join(root, ".toolchain", "node-v24.16.0-win-x64", "node.exe");
const port = process.env.LOGINTO_DESKTOP_PORT || "4173";

const child = spawn(nodePath, ["apps/desktop/scripts/dev-server.mjs"], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: {
    LOGINTO_DESKTOP_PORT: port,
    PATH: [
      join(root, ".toolchain", "node-v24.16.0-win-x64"),
      "C:\\Windows\\System32",
      "C:\\Windows"
    ].join(";")
  }
});

child.unref();
console.log(`LoginTo desktop preview starting at http://127.0.0.1:${port}`);
