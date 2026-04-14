import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

function parseArgs(argv) {
  const parsed = {
    sources: [],
    destinationIsDirectory: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    if (key === "destination-is-directory") {
      parsed.destinationIsDirectory = true;
      continue;
    }

    const value = argv[index + 1];
    index += 1;

    if (key === "source") {
      parsed.sources.push(value);
      continue;
    }

    parsed[key] = value;
  }

  return parsed;
}

function splitHostAlias(hostAlias) {
  const atIndex = hostAlias.lastIndexOf("@");
  if (atIndex >= 0) {
    return {
      username: hostAlias.slice(0, atIndex),
      host: hostAlias.slice(atIndex + 1),
    };
  }

  return {
    username: "root",
    host: hostAlias,
  };
}

function loadExpectedHostKey(knownHostsPath, host) {
  if (!knownHostsPath || !fs.existsSync(knownHostsPath)) {
    return null;
  }

  const lines = fs.readFileSync(knownHostsPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
      continue;
    }

    const hosts = parts[0].split(",");
    if (!hosts.includes(host)) {
      continue;
    }

    return Buffer.from(parts[2], "base64");
  }

  return null;
}

function loadSsh2(runtimeDir) {
  const requireFromRuntime = createRequire(path.resolve(runtimeDir, "index.js"));
  return requireFromRuntime("ssh2");
}

async function connectClient({ hostAlias, privateKeyPath, knownHostsPath, runtimeDir, connectTimeoutSec }) {
  if (!privateKeyPath || !fs.existsSync(privateKeyPath)) {
    throw new Error(`Private key not found: ${privateKeyPath}`);
  }

  const { Client } = loadSsh2(runtimeDir);
  const { username, host } = splitHostAlias(hostAlias);
  const expectedHostKey = loadExpectedHostKey(knownHostsPath, host);
  const privateKey = fs.readFileSync(privateKeyPath, "utf8");

  return await new Promise((resolve, reject) => {
    const client = new Client();
    client
      .on("ready", () => resolve(client))
      .on("error", reject)
      .connect({
        host,
        username,
        privateKey,
        readyTimeout: Math.max(Number(connectTimeoutSec || 20), 1) * 1000,
        hostVerifier: expectedHostKey
          ? (presentedKey) =>
              Buffer.isBuffer(presentedKey) &&
              expectedHostKey.length === presentedKey.length &&
              crypto.timingSafeEqual(expectedHostKey, presentedKey)
          : undefined,
      });
  });
}

async function execCommand(client, command) {
  return await new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      let exitCode = 0;
      stream.on("data", (chunk) => process.stdout.write(chunk));
      stream.stderr.on("data", (chunk) => process.stderr.write(chunk));
      stream.on("exit", (code) => {
        if (typeof code === "number") {
          exitCode = code;
        }
      });
      stream.on("close", () => resolve(exitCode));
    });
  });
}

async function createSftp(client) {
  return await new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(sftp);
    });
  });
}

async function uploadFiles(client, sources, destination, destinationIsDirectory) {
  const sftp = await createSftp(client);

  try {
    for (const source of sources) {
      const remotePath = destinationIsDirectory
        ? path.posix.join(destination, path.basename(source))
        : destination;

      await new Promise((resolve, reject) => {
        sftp.fastPut(source, remotePath, (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  } finally {
    sftp.end();
  }
}

async function main() {
  const [mode, ...argv] = process.argv.slice(2);
  if (!mode) {
    throw new Error("Missing mode. Use exec or upload.");
  }

  const args = parseArgs(argv);
  const runtimeDir = args["runtime-dir"] || path.resolve(".codex-local/ssh-runtime");

  const client = await connectClient({
    hostAlias: args.host,
    privateKeyPath: args["private-key"],
    knownHostsPath: args["known-hosts"],
    runtimeDir,
    connectTimeoutSec: args["connect-timeout-sec"],
  });

  try {
    if (mode === "exec") {
      const exitCode = await execCommand(client, args.command || "");
      process.exitCode = exitCode;
      return;
    }

    if (mode === "upload") {
      if (!args.destination) {
        throw new Error("Missing --destination for upload mode.");
      }
      if (!args.sources.length) {
        throw new Error("Missing --source for upload mode.");
      }

      await uploadFiles(client, args.sources, args.destination, args.destinationIsDirectory);
      return;
    }

    throw new Error(`Unsupported mode: ${mode}`);
  } finally {
    client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
