import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { packageUsablePreview } from "./package-usable-preview.mjs";

const root = process.cwd();
const outputDir = join(root, ".tmp-package-smoke", "LoginTo-usable-preview");

await rm(join(root, ".tmp-package-smoke"), { recursive: true, force: true });

const result = await packageUsablePreview({
  outputDir,
  skipReadiness: true
});

await assertFile(join(outputDir, "LoginTo.cmd"));
await assertFile(join(outputDir, "LoginTo-SQLite.cmd"));
await assertFile(join(outputDir, "LoginTo-Start.cmd"));
await assertFile(join(outputDir, "LoginTo-Start-SQLite.cmd"));
await assertFile(join(outputDir, "LoginTo-App-Windows.cmd"));
await assertFile(join(outputDir, "LoginTo-Check.cmd"));
await assertFile(join(outputDir, "LoginTo-Stop.cmd"));
await assertFile(join(outputDir, "LoginTo-Data-Folder.cmd"));
await assertFile(join(outputDir, "LoginTo-Report.cmd"));
await assertFile(join(outputDir, "LoginTo-Acceptance.cmd"));
await assertFile(join(outputDir, "USABLE_PREVIEW.md"));
await assertFile(join(outputDir, "manifest.json"));
await assertFile(join(outputDir, "README-package.md"));

const manifest = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));
assert(manifest.localOnly === true, "package manifest should mark the preview as local-only");
assert(manifest.previewUrls.desktop === "http://127.0.0.1:4173", "package manifest should include desktop preview URL");
assert(manifest.files.includes("LoginTo.cmd"), "package manifest should list the main app launcher");
assert(manifest.files.includes("LoginTo-SQLite.cmd"), "package manifest should list the SQLite app launcher");
assert(manifest.files.includes("LoginTo-Start.cmd"), "package manifest should list launchers");
assert(manifest.files.includes("LoginTo-Start-SQLite.cmd"), "package manifest should list the SQLite launcher");
assert(manifest.capabilities?.desktopStorageModes?.includes("sqlite"), "package manifest should describe SQLite desktop storage");
assert(manifest.files.includes("LoginTo-App-Windows.cmd"), "package manifest should list app window launcher");
assert(manifest.files.includes("LoginTo-Check.cmd"), "package manifest should list health check launcher");
assert(manifest.files.includes("LoginTo-Data-Folder.cmd"), "package manifest should list local data folder launcher");
assert(manifest.capabilities?.localDataFolderLauncher === "LoginTo-Data-Folder.cmd", "package manifest should describe the local data folder launcher");
assert(result.files.includes("README-package.md"), "package helper should report the generated readme");

const readme = await readFile(join(outputDir, "README-package.md"), "utf8");
assert(readme.includes("面对面信任"), "package readme should explain face-to-face trust");
assert(readme.includes("LoginTo.cmd"), "package readme should point to the main app launcher");
assert(readme.includes("LoginTo-SQLite.cmd"), "package readme should point to the SQLite app launcher");
assert(readme.includes("LoginTo-Check.cmd"), "package readme should point to the health check command");
assert(readme.includes("LoginTo-Data-Folder.cmd"), "package readme should point to the local data folder command");
assert(readme.includes("LoginTo-Start-SQLite.cmd"), "package readme should point to the SQLite start command");
assert(readme.includes("LoginTo-Acceptance.cmd"), "package readme should point to acceptance");

const mainLauncher = await readFile(join(outputDir, "LoginTo.cmd"), "utf8");
const sqliteMainLauncher = await readFile(join(outputDir, "LoginTo-SQLite.cmd"), "utf8");
const startLauncher = await readFile(join(outputDir, "LoginTo-Start.cmd"), "utf8");
const sqliteStartLauncher = await readFile(join(outputDir, "LoginTo-Start-SQLite.cmd"), "utf8");
const appWindowLauncher = await readFile(join(outputDir, "LoginTo-App-Windows.cmd"), "utf8");
const checkLauncher = await readFile(join(outputDir, "LoginTo-Check.cmd"), "utf8");
const stopLauncher = await readFile(join(outputDir, "LoginTo-Stop.cmd"), "utf8");
const dataFolderLauncher = await readFile(join(outputDir, "LoginTo-Data-Folder.cmd"), "utf8");
assert(mainLauncher.includes(`call "${join(root, "LoginTo.cmd")}"`), "packaged main launcher should invoke the source main command");
assert(sqliteMainLauncher.includes(`call "${join(root, "LoginTo-SQLite.cmd")}"`), "packaged SQLite main launcher should invoke the source SQLite app command");
assert(startLauncher.includes(`cd /d "${root}"`), "packaged start launcher should call back into the source workspace");
assert(startLauncher.includes(`call "${join(root, "LoginTo-Start.cmd")}"`), "packaged start launcher should invoke the source start command");
assert(sqliteStartLauncher.includes(`call "${join(root, "LoginTo-Start-SQLite.cmd")}"`), "packaged SQLite start launcher should invoke the source SQLite start command");
assert(appWindowLauncher.includes(`call "${join(root, "LoginTo-App-Windows.cmd")}"`), "packaged app window launcher should invoke the source app window command");
assert(checkLauncher.includes(`call "${join(root, "LoginTo-Check.cmd")}"`), "packaged health check launcher should invoke the source check command");
assert(stopLauncher.includes(`call "${join(root, "LoginTo-Stop.cmd")}"`), "packaged stop launcher should invoke the source stop command");
assert(dataFolderLauncher.includes(`call "${join(root, "LoginTo-Data-Folder.cmd")}"`), "packaged data folder launcher should invoke the source data folder command");

console.log("Usable preview package smoke test passed.");

async function assertFile(path) {
  try {
    const info = await stat(path);
    assert(info.isFile(), `${path} should be a file`);
  } catch (error) {
    throw new Error(`Expected file missing: ${path}\n${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
