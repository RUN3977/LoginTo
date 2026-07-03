import { startDesktopNativeShell } from "./start-desktop-native-shell.mjs";

const result = await startDesktopNativeShell({
  open: false,
  timeoutMs: 10_000
});

assert(result.ok === true, "desktop native shell should report ok");
assert(result.url.startsWith("http://127.0.0.1:"), "desktop native shell should bind to localhost");
assert(result.product === "LoginTo desktop shell", "desktop native shell should start the desktop product");
assert(result.logs.out.endsWith("desktop-native-shell.out.log"), "desktop native shell should write a readable output log");

console.log("Desktop native shell smoke test passed.");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
