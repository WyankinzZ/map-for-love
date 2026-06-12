import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const standaloneNextDir = path.join(standaloneDir, ".next");

async function copyIfPresent(from, to) {
  try {
    await cp(from, to, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await mkdir(standaloneNextDir, { recursive: true });
await copyIfPresent(path.join(root, "public"), path.join(standaloneDir, "public"));
await copyIfPresent(path.join(root, ".next", "static"), path.join(standaloneNextDir, "static"));
await copyIfPresent(path.join(root, "data", "localMemories.json"), path.join(standaloneDir, "data", "localMemories.json"));

await Promise.all(
  ["localMemories.private.json", "cityAssets.private.json", "loginPhotos.private.json"].map((fileName) =>
    rm(path.join(standaloneDir, "data", fileName), { force: true }),
  ),
);

console.log("[desktop] standalone assets prepared");
