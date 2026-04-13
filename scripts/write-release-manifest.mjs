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

function normalizeSemVer(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/^v/i, "");
  return /^\d+\.\d+\.\d+$/.test(normalized) ? normalized : null;
}

function readOptionalEnvString(name) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function readOptionalEnvBoolean(name) {
  const value = readOptionalEnvString(name);
  if (!value) {
    return null;
  }

  if (/^(true|1|yes)$/i.test(value)) {
    return true;
  }

  if (/^(false|0|no)$/i.test(value)) {
    return false;
  }

  return null;
}

const packageJson = readJson(packageJsonPath);
const commit = tryRunGit(["rev-parse", "HEAD"]) || null;
const commitShort = tryRunGit(["rev-parse", "--short", "HEAD"]) || (commit ? commit.slice(0, 7) : null);
const statusOutput = commit ? tryRunGit(["status", "--porcelain=v1", "--untracked-files=all"]) : "";
const packageVersion = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
const overrideVersionRaw = process.env.RELEASE_VERSION_OVERRIDE ?? "";
const overrideVersion = normalizeSemVer(overrideVersionRaw);
const resolvedVersion = overrideVersion ?? packageVersion;
const buildSource = readOptionalEnvString("RELEASE_BUILD_SOURCE");
const sourceWorkspaceDirty = readOptionalEnvBoolean("RELEASE_SOURCE_WORKSPACE_DIRTY");

if (overrideVersionRaw && !overrideVersion) {
  console.warn(`ignored invalid RELEASE_VERSION_OVERRIDE: ${overrideVersionRaw}`);
}

const releaseManifest = {
  name: typeof packageJson.name === "string" ? packageJson.name : "mold-gantt-v3",
  version: resolvedVersion,
  commit,
  commitShort,
  builtAt: new Date().toISOString(),
  dirty: commit ? statusOutput.length > 0 : null,
  buildSource,
  sourceWorkspaceDirty,
};

mkdirSync(distDir, { recursive: true });
writeFileSync(releaseManifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, "utf8");

console.log(`release manifest written -> ${path.relative(repoRoot, releaseManifestPath)}`);
