import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resetPreviewState } from "./reset-preview-state.mjs";

const root = process.cwd();
const targetDir = join(root, ".tmp-reset-preview-state-smoke");
const archiveRoot = join(root, ".tmp-reset-preview-state-archives-smoke");

await rm(targetDir, { recursive: true, force: true });
await rm(archiveRoot, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await writeFile(join(targetDir, "old-state.txt"), "old preview state", "utf8");

const result = await resetPreviewState({
  targetDir,
  archiveRoot,
  now: new Date("2026-06-29T12:00:00.000Z")
});

if (!result.ok || !result.archived || !result.archiveDir) {
  throw new Error("Expected reset preview state to archive an existing directory");
}

const archivedText = await readFile(join(result.archiveDir, "old-state.txt"), "utf8");
if (archivedText !== "old preview state") {
  throw new Error("Expected archived preview state to preserve old files");
}

const markerText = await readFile(result.markerPath, "utf8");
if (!markerText.includes("Previous preview state archive")) {
  throw new Error("Expected reset marker to point at the archived preview state");
}

await stat(targetDir);
await rm(targetDir, { recursive: true, force: true });
await rm(archiveRoot, { recursive: true, force: true });

console.log("Reset preview state smoke test passed.");
console.log(
  JSON.stringify(
    {
      archived: result.archived,
      archiveDir: result.archiveDir,
      markerPath: result.markerPath
    },
    null,
    2
  )
);
