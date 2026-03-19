import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "dist");
const packageJsonPath = path.join(repoRoot, "package.json");
const releaseManifestPath = path.join(distDir, "release.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function tryRunGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const packageJson = readJson(packageJsonPath);
const commit = tryRunGit(["rev-parse", "HEAD"]) || null;
const commitShort = tryRunGit(["rev-parse", "--short", "HEAD"]) || (commit ? commit.slice(0, 7) : null);
const statusOutput = commit ? tryRunGit(["status", "--porcelain=v1", "--untracked-files=all"]) : "";

const releaseManifest = {
  name: typeof packageJson.name === "string" ? packageJson.name : "mold-gantt-v3",
  version: typeof packageJson.version === "string" ? packageJson.version : "0.0.0",
  commit,
  commitShort,
  builtAt: new Date().toISOString(),
  dirty: commit ? statusOutput.length > 0 : null,
};

mkdirSync(distDir, { recursive: true });
writeFileSync(releaseManifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, "utf8");

console.log(`release manifest written -> ${path.relative(repoRoot, releaseManifestPath)}`);
