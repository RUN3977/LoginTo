import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const defaultTargetDir = join(root, ".tmp");
const defaultArchiveRoot = join(root, ".tmp-archives");

export async function resetPreviewState(input = {}) {
  const targetDir = resolve(input.targetDir ?? process.env.LOGINTO_RESET_PREVIEW_STATE_DIR ?? defaultTargetDir);
  const archiveRoot = resolve(input.archiveRoot ?? process.env.LOGINTO_RESET_PREVIEW_ARCHIVE_DIR ?? defaultArchiveRoot);
  const stamp = createArchiveStamp(input.now ?? new Date());
  const archiveDir = join(archiveRoot, `loginto-preview-state-${stamp}`);

  if (targetDir === archiveRoot || archiveRoot.startsWith(`${targetDir}\\`) || archiveRoot.startsWith(`${targetDir}/`)) {
    throw new Error("Archive directory must not be inside the preview state directory");
  }

  await mkdir(archiveRoot, { recursive: true });
  const existed = await pathExists(targetDir);
  if (existed) {
    await rename(targetDir, archiveDir);
  }
  await mkdir(targetDir, { recursive: true });
  const markerPath = join(targetDir, "README-reset.txt");
  await writeFile(
    markerPath,
    [
      "LoginTo preview state was reset.",
      existed ? `Previous preview state archive: ${archiveDir}` : "No previous preview state directory existed.",
      ""
    ].join("\n"),
    "utf8"
  );

  return {
    ok: true,
    targetDir,
    archiveDir: existed ? archiveDir : undefined,
    markerPath,
    archived: existed
  };
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function createArchiveStamp(date) {
  return date.toISOString().replaceAll(":", "").replaceAll(".", "-");
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  if (!process.argv.includes("--yes")) {
    console.error("Refusing to reset preview state without --yes.");
    process.exit(2);
  }
  const result = await resetPreviewState();
  console.log("LoginTo preview state reset complete.");
  console.log(`New state directory: ${result.targetDir}`);
  if (result.archiveDir) {
    console.log(`Archived previous state: ${result.archiveDir}`);
  }
}
