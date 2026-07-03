import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createReadinessReport } from "./create-readiness-report.mjs";

const root = process.cwd();
const defaultOutputDir = join(root, "dist", "LoginTo-usable-preview");

const launcherFiles = [
  "LoginTo.cmd",
  "LoginTo-SQLite.cmd",
  "LoginTo-App-Windows.cmd",
  "LoginTo-App-Desktop.cmd",
  "LoginTo-App-Phone.cmd",
  "LoginTo-App-Tablet.cmd",
  "LoginTo-Desktop.cmd",
  "LoginTo-Start.cmd",
  "LoginTo-Start-SQLite.cmd",
  "LoginTo-Check.cmd",
  "LoginTo-Stop.cmd",
  "LoginTo-Data-Folder.cmd",
  "LoginTo-Report.cmd",
  "LoginTo-Reset-Preview.cmd",
  "LoginTo-Reset-Demo.cmd",
  "LoginTo-Acceptance.cmd"
];

const reportFiles = [
  {
    source: ".tmp/loginto-readiness-report.md",
    target: "reports/loginto-readiness-report.md",
    label: "readiness report"
  },
  {
    source: ".tmp/loginto-usable-preview-acceptance.md",
    target: "reports/loginto-usable-preview-acceptance.md",
    label: "acceptance report"
  }
];

export async function packageUsablePreview(input = {}) {
  const outputDir = resolve(input.outputDir ?? process.env.LOGINTO_USABLE_PREVIEW_PACKAGE_DIR ?? defaultOutputDir);
  const generatedAt = new Date().toISOString();

  if (!input.skipReadiness) {
    await createReadinessReport();
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const copiedFiles = [];
  for (const file of launcherFiles) {
    await writeFile(join(outputDir, file), renderLauncherWrapper(file), "utf8");
    copiedFiles.push(file);
  }

  if (await copyIfExists(join(root, "USABLE_PREVIEW.md"), join(outputDir, "USABLE_PREVIEW.md"))) {
    copiedFiles.push("USABLE_PREVIEW.md");
  }

  for (const file of reportFiles) {
    if (await copyIfExists(join(root, file.source), join(outputDir, file.target))) {
      copiedFiles.push(file.target);
    }
  }

  const manifest = {
    product: "LoginTo",
    packageName: "LoginTo usable preview handoff",
    generatedAt,
    sourceRoot: root,
    outputDir,
    localOnly: true,
    previewUrls: {
      desktop: "http://127.0.0.1:4173",
      mobile: "http://127.0.0.1:4177",
      tablet: "http://127.0.0.1:4178"
    },
    capabilities: {
      desktopStorageModes: ["file", "sqlite"],
      sqliteDesktopLauncher: "LoginTo-SQLite.cmd",
      sqliteBrowserPreviewLauncher: "LoginTo-Start-SQLite.cmd",
      trustedPairing: "qr-six-digit-code",
      syncRequiresLocalPeer: true,
      localDataFolderLauncher: "LoginTo-Data-Folder.cmd"
    },
    launchers: launcherFiles,
    reports: reportFiles.map((file) => file.target),
    files: copiedFiles
  };

  await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(outputDir, "README-package.md"), renderPackageReadme(manifest), "utf8");

  return {
    ok: true,
    outputDir,
    manifestPath: join(outputDir, "manifest.json"),
    files: [...copiedFiles, "manifest.json", "README-package.md"]
  };
}

async function copyIfExists(sourcePath, targetPath) {
  try {
    await stat(sourcePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  return true;
}

function renderPackageReadme(manifest) {
  return [
    "# LoginTo 可用预览交付包",
    "",
    `生成时间：${manifest.generatedAt}`,
    "",
    "这个目录是当前本机可用预览版的交付索引，不是正式安装包。数据仍只保存在本机工程目录的 `.tmp` 中；同步仍遵循面对面信任和每次同步确认。",
    "",
    "## 怎么用",
    "",
    "1. 双击 `LoginTo.cmd` 打开桌面、手机、平板三端本机 App 窗口。",
    "2. 双击 `LoginTo-SQLite.cmd` 用桌面端 SQLite 本机数据库打开三端 App 窗口。",
    "3. 也可以只打开单端：`LoginTo-App-Desktop.cmd`、`LoginTo-App-Phone.cmd`、`LoginTo-App-Tablet.cmd`。",
    "4. 双击 `LoginTo-Start.cmd` 启动浏览器预览服务，便于调试三端地址。",
    "5. 双击 `LoginTo-Start-SQLite.cmd` 启动桌面端 SQLite 浏览器预览模式。",
    "6. 双击 `LoginTo-Check.cmd` 检查当前三端服务是否在线。",
    "7. 打开三端体验记录、提醒、拍照整理、配对同步和冲突处理。",
    "8. 双击 `LoginTo-Data-Folder.cmd` 打开本机 `.tmp` 数据目录。",
    "9. 双击 `LoginTo-Report.cmd` 生成当前可用性报告。",
    "10. 双击 `LoginTo-Acceptance.cmd` 运行完整验收。",
    "11. 双击 `LoginTo-Reset-Preview.cmd` 可归档并重置预览数据；`LoginTo-Reset-Demo.cmd` 仅作为旧入口兼容。",
    "",
    "## 默认地址",
    "",
    `- 桌面端：${manifest.previewUrls.desktop}`,
    `- 手机端：${manifest.previewUrls.mobile}`,
    `- 平板端：${manifest.previewUrls.tablet}`,
    "",
    "## 包内文件",
    "",
    ...manifest.files.map((file) => `- ${file}`),
    "",
    "## 源工程",
    "",
    `- ${manifest.sourceRoot}`,
    ""
  ].join("\n");
}

function renderLauncherWrapper(file) {
  return [
    "@echo off",
    "setlocal",
    `cd /d "${root}"`,
    `call "${join(root, file)}" %*`
  ].join("\r\n") + "\r\n";
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  const result = await packageUsablePreview();
  console.log("LoginTo usable preview package generated.");
  console.log(`Package: ${result.outputDir}`);
  console.log(`Manifest: ${result.manifestPath}`);

  const readme = await readFile(join(result.outputDir, "README-package.md"), "utf8");
  const summary = readme.split("\n").slice(0, 12).join("\n");
  console.log("");
  console.log(summary);
}
