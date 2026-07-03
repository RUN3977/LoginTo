import { openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = process.cwd();
const nodePath = join(root, ".toolchain", "node-v24.16.0-win-x64", "node.exe");
const logDir = join(root, ".tmp");
const outLog = join(logDir, "terminal-previews-detached.out.log");
const errLog = join(logDir, "terminal-previews-detached.err.log");

await mkdir(logDir, { recursive: true });

const outFd = openSync(outLog, "a");
const errFd = openSync(errLog, "a");

const childArgs = ["tools/start-terminal-previews.mjs"];
if (process.argv.includes("--open")) {
  childArgs.push("--open");
}

const child = spawn(nodePath, childArgs, {
  cwd: root,
  detached: true,
  stdio: ["ignore", outFd, errFd],
  windowsHide: true,
  env: createChildEnv()
});

child.unref();

console.log("LoginTo terminal previews detached launcher started.");
console.log(`Process id: ${child.pid}`);
console.log(`Desktop: http://127.0.0.1:${process.env.LOGINTO_DESKTOP_PORT ?? "4173"}`);
console.log(`Mobile:  http://127.0.0.1:${process.env.LOGINTO_MOBILE_PORT ?? "4177"}`);
console.log(`Tablet:  http://127.0.0.1:${process.env.LOGINTO_TABLET_PORT ?? "4178"}`);
console.log(`Open browser: ${process.argv.includes("--open") ? "yes" : "no"}`);
console.log(`Output log: ${resolve(outLog)}`);
console.log(`Error log:  ${resolve(errLog)}`);

function createChildEnv() {
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "path")
  );
  return {
    ...baseEnv,
    Path: [
      join(root, ".toolchain", "node-v24.16.0-win-x64"),
      join(root, ".toolchain", "cargo", "bin"),
      process.env.PATH ?? process.env.Path ?? ""
    ].join(";"),
    LOGINTO_DESKTOP_PORT: process.env.LOGINTO_DESKTOP_PORT ?? "4173",
    LOGINTO_MOBILE_PORT: process.env.LOGINTO_MOBILE_PORT ?? "4177",
    LOGINTO_TABLET_PORT: process.env.LOGINTO_TABLET_PORT ?? "4178"
  };
}
