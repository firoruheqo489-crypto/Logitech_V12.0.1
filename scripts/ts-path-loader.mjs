import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const loaderDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(loaderDir, "..");

function resolveAliasTarget(specifier) {
  if (specifier.startsWith("@/")) {
    return path.resolve(repoRoot, "client", "src", specifier.slice(2));
  }

  if (specifier.startsWith("@shared/")) {
    return path.resolve(repoRoot, "shared", specifier.slice("@shared/".length));
  }

  if (specifier === "@shared") {
    return path.resolve(repoRoot, "shared");
  }

  return null;
}

function resolveExistingFile(basePath) {
  const extension = path.extname(basePath);
  const withoutExtension = extension ? basePath.slice(0, -extension.length) : basePath;
  const candidates = [basePath];

  if (!extension) {
    candidates.push(
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      `${basePath}.mjs`,
      `${basePath}.cjs`,
    );
  }

  if ([".js", ".mjs", ".cjs"].includes(extension)) {
    candidates.push(
      `${withoutExtension}.ts`,
      `${withoutExtension}.tsx`,
      `${withoutExtension}.js`,
      `${withoutExtension}.mjs`,
      `${withoutExtension}.cjs`,
    );
  }

  candidates.push(
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
    path.join(basePath, "index.cjs"),
  );

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function resolveRelativeTarget(specifier, parentURL) {
  if (!parentURL || !specifier.startsWith(".")) {
    return null;
  }

  const parentPath = fileURLToPath(parentURL);
  return resolveExistingFile(path.resolve(path.dirname(parentPath), specifier));
}

export async function resolve(specifier, context, defaultResolve) {
  const aliasTarget = resolveAliasTarget(specifier);
  if (aliasTarget) {
    const resolvedPath = resolveExistingFile(aliasTarget);
    if (!resolvedPath) {
      throw new Error(`Alias target not found for ${specifier}`);
    }

    return {
      shortCircuit: true,
      url: pathToFileURL(resolvedPath).href,
    };
  }

  const relativeTarget = resolveRelativeTarget(specifier, context.parentURL);
  if (relativeTarget) {
    return {
      shortCircuit: true,
      url: pathToFileURL(relativeTarget).href,
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}
