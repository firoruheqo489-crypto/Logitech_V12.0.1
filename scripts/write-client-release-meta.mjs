import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "client", "src", "generated", "releaseMeta.ts");

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

function readOptionalEnvString(name) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

const releaseMeta = {
  commit: readOptionalEnvString("RELEASE_COMMIT_OVERRIDE") || tryRunGit(["rev-parse", "HEAD"]) || null,
  commitShort:
    readOptionalEnvString("RELEASE_COMMIT_SHORT_OVERRIDE") ||
    tryRunGit(["rev-parse", "--short", "HEAD"]) ||
    null,
  builtAt: new Date().toISOString(),
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `export const CLIENT_RELEASE_META = ${JSON.stringify(releaseMeta, null, 2)} as const;\n`,
  "utf8",
);

console.log(`client release meta written -> ${path.relative(repoRoot, outputPath)}`);
