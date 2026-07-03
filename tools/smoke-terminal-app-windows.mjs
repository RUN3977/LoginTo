import { startTerminalAppWindows, stopTerminalAppWindows } from "./start-terminal-app-windows.mjs";

const result = await startTerminalAppWindows({
  open: false,
  printPreviews: false,
  timeoutMs: 10_000
});

try {
  assert(result.ok === true, "terminal app windows should verify all products");
  assert(result.terminals.length === 3, "terminal app windows should cover three terminals");
  assertTerminal(result, "desktop", "LoginTo desktop shell");
  assertTerminal(result, "mobile", "LoginTo mobile shell");
  assertTerminal(result, "tablet", "LoginTo tablet shell");
  assert(result.terminals.every((terminal) => terminal.appWindow.skipped === true), "smoke should not open visible windows");

  console.log("Terminal app window smoke test passed.");
} finally {
  await stopTerminalAppWindows(result);
}

const phoneOnly = await startTerminalAppWindows({
  open: false,
  printPreviews: false,
  timeoutMs: 10_000,
  terminals: ["mobile"]
});

try {
  assert(phoneOnly.selectedTerminals.length === 1 && phoneOnly.selectedTerminals[0] === "mobile", "terminal app windows should accept a single selected terminal");
  assert(phoneOnly.terminals.length === 1, "single terminal app window should verify one terminal");
  assertTerminal(phoneOnly, "mobile", "LoginTo mobile shell");
} finally {
  await stopTerminalAppWindows(phoneOnly);
}

function assertTerminal(result, name, product) {
  const terminal = result.terminals.find((item) => item.name === name);
  assert(Boolean(terminal), `missing terminal: ${name}`);
  assert(terminal.url.startsWith("http://127.0.0.1:"), `${name} should bind to localhost`);
  assert(terminal.product === product, `${name} should verify ${product}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
