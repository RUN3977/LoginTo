import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const desktopRoot = join(__dirname, "..");
const html = await readFile(join(desktopRoot, "prototype", "index.html"), "utf8");
const server = await readFile(join(desktopRoot, "scripts", "dev-server.mjs"), "utf8");

const requiredHtml = [
  "LoginTo",
  "会员到期提醒",
  "终端同步",
  "拍照录入",
  "面对面配对"
];

const requiredServer = [
  "createServer",
  "/api/status",
  "LoginTo desktop shell running"
];

const failures = [];
for (const text of requiredHtml) {
  if (!html.includes(text)) {
    failures.push(`prototype missing text: ${text}`);
  }
}
for (const text of requiredServer) {
  if (!server.includes(text)) {
    failures.push(`dev server missing text: ${text}`);
  }
}

if (failures.length > 0) {
  console.error("Desktop app shell check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Desktop app shell check passed.");
