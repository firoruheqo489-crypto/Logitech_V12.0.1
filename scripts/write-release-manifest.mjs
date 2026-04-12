import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "dist");
const packageJsonPath = path.join(repoRoot, "package.json");
const releaseManifestPath = path.join(distDir, "release.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function resolveGitDir(rootDir) {
  const dotGitPath = path.join(rootDir, ".git");

  try {
    const stat = statSync(dotGitPath);
    if (stat.isDirectory()) {
      return dotGitPath;
    }
  } catch {
    return null;
  }

  try {
    const raw = readFileSync(dotGitPath, "utf8").trim();
    const match = /^gitdir:\s*(.+)$/i.exec(raw);
    if (!match?.[1]) {
      return null;
    }

    return path.resolve(rootDir, match[1].trim());
  } catch {
    return null;
  }
}

function readPackedRef(gitDir, refName) {
  const packedRefsPath = path.join(gitDir, "packed-refs");

  try {
    const lines = readFileSync(packedRefsPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("^")) {
        continue;
      }

      const [hash, ref] = trimmed.split(" ");
      if (ref === refName && hash) {
        return hash.trim();
      }
    }
  } catch {
  }

  return "";
}

function readGitCommitFromFiles(rootDir) {
  const gitDir = resolveGitDir(rootDir);
  if (!gitDir) {
    return "";
  }

  try {
    const headPath = path.join(gitDir, "HEAD");
    const headValue = readFileSync(headPath, "utf8").trim();
    if (!headValue) {
      return "";
    }

    if (!headValue.startsWith("ref:")) {
      return headValue;
    }

    const refName = headValue.slice(5).trim();
    if (!refName) {
      return "";
    }

    const refPath = path.join(gitDir, ...refName.split("/"));
    try {
      return readFileSync(refPath, "utf8").trim();
    } catch {
      return readPackedRef(gitDir, refName);
    }
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

const packageJson = readJson(packageJsonPath);
const commit = readGitCommitFromFiles(repoRoot) || null;
const commitShort = commit ? commit.slice(0, 7) : null;
const packageVersion = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
const overrideVersionRaw = process.env.RELEASE_VERSION_OVERRIDE ?? "";
const overrideVersion = normalizeSemVer(overrideVersionRaw);
const resolvedVersion = overrideVersion ?? packageVersion;

if (overrideVersionRaw && !overrideVersion) {
  console.warn(`ignored invalid RELEASE_VERSION_OVERRIDE: ${overrideVersionRaw}`);
}

const releaseManifest = {
  name: typeof packageJson.name === "string" ? packageJson.name : "mold-gantt-v3",
  version: resolvedVersion,
  commit,
  commitShort,
  builtAt: new Date().toISOString(),
  dirty: null,
};

mkdirSync(distDir, { recursive: true });
writeFileSync(releaseManifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, "utf8");

console.log(`release manifest written -> ${path.relative(repoRoot, releaseManifestPath)}`);
