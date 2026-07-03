import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { checkTerminalPreviews } from "./check-terminal-previews.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const nodePath = process.execPath;
const basePort = 52000 + Math.floor(Math.random() * 1000);
const ports = {
  desktop: String(basePort),
  mobile: String(basePort + 1),
  tablet: String(basePort + 2)
};
process.env.LOGINTO_DESKTOP_PORT = ports.desktop;
process.env.LOGINTO_MOBILE_PORT = ports.mobile;
process.env.LOGINTO_TABLET_PORT = ports.tablet;

let previewPid;

try {
  const { stdout } = await execFileAsync(nodePath, ["tools/start-terminal-previews-detached.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      LOGINTO_DESKTOP_PORT: ports.desktop,
      LOGINTO_MOBILE_PORT: ports.mobile,
      LOGINTO_TABLET_PORT: ports.tablet
    },
    timeout: 10_000
  });

  previewPid = parsePreviewPid(stdout);

  const health = await checkTerminalPreviews({
    timeoutMs: 10_000,
    fallbackSpan: 0
  });
  if (!health.ok) {
    throw new Error(`Expected detached previews to pass health check: ${JSON.stringify(health, null, 2)}`);
  }

  console.log("Terminal detached preview smoke test passed.");
  console.log(
    JSON.stringify(
      {
        pid: previewPid,
        desktop: health.terminals[0].product,
        mobile: health.terminals[1].product,
        tablet: health.terminals[2].product,
        healthCheck: health.ok
      },
      null,
      2
    )
  );
} finally {
  if (previewPid) {
    try {
      process.kill(previewPid);
    } catch {
      // The child may already have exited after a failed start.
    }
  }
}

function parsePreviewPid(output) {
  const match = output.match(/Process id:\s*(\d+)/);
  if (!match) {
    throw new Error(`Unable to find detached preview pid in launcher output:\n${output}`);
  }
  return Number(match[1]);
}
