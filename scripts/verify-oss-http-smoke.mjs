import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c/aQAAAAASUVORK5CYII=',
  'base64',
);

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://127.0.0.1:3001',
    envFile: '.env',
    label: 'oss-smoke',
    apiKey: '',
    waitForDbReady: false,
    waitRetries: 90,
    waitIntervalMs: 1000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--base-url') {
      args.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--env-file') {
      args.envFile = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--label') {
      args.label = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--api-key') {
      args.apiKey = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--wait-for-db-ready') {
      args.waitForDbReady = true;
      continue;
    }

    if (arg === '--wait-retries') {
      args.waitRetries = Number(argv[index + 1] ?? args.waitRetries);
      index += 1;
      continue;
    }

    if (arg === '--wait-interval-ms') {
      args.waitIntervalMs = Number(argv[index + 1] ?? args.waitIntervalMs);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return new Map();
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\n/);
  const map = new Map();

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.trimStart().startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (key) {
      map.set(key, value);
    }
  }

  return map;
}

async function readJson(response, step) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${step} failed with status ${response.status}. Body: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${step} returned non-JSON body: ${text}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readHealthPayload(baseUrl) {
  const response = await fetch(`${baseUrl}/api/health`);
  return readJson(response, 'Health check');
}

async function waitForDbReady(baseUrl, retries, intervalMs) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const payload = await readHealthPayload(baseUrl);

    if (payload?.warmup?.phase === 'failed') {
      throw new Error(`DB warmup failed before smoke could start: ${JSON.stringify(payload)}`);
    }

    if (payload?.dbReady === true) {
      console.log(`[PASS] DB warmup ready at ${baseUrl}/api/health on attempt ${attempt}.`);
      return;
    }

    console.log(
      `[INFO] Waiting for DB warmup... attempt ${attempt}/${retries} phase=${payload?.warmup?.phase ?? 'unknown'}`,
    );
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for DB warmup at ${baseUrl}`);
}

async function assertHealth(baseUrl) {
  const payload = await readHealthPayload(baseUrl);

  if (!payload?.ok || !payload?.api || payload?.dbReady !== true) {
    throw new Error(`Health check payload was not healthy: ${JSON.stringify(payload)}`);
  }

  console.log(`[PASS] Health check ok at ${baseUrl}/api/health`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(projectRoot, args.envFile);
  const envMap = parseEnvFile(envPath);
  const apiKey = args.apiKey || process.env.API_SECRET_KEY || envMap.get('API_SECRET_KEY')?.trim();

  if (!apiKey) {
    throw new Error(`API_SECRET_KEY is required for OSS smoke. Checked ${path.relative(projectRoot, envPath)}.`);
  }

  const baseUrl = args.baseUrl.replace(/\/+$/, '');
  const smokeName = `${args.label}-${crypto.randomUUID()}`;
  const uploadHeaders = {
    'x-api-key': apiKey,
  };

  let uploadedUrl = '';
  let deleted = false;

  console.log(`[INFO] OSS smoke started. baseUrl=${baseUrl} label=${args.label}`);
  if (args.waitForDbReady) {
    await waitForDbReady(baseUrl, args.waitRetries, args.waitIntervalMs);
  }
  await assertHealth(baseUrl);

  try {
    const formData = new FormData();
    formData.set('file', new Blob([PNG_BYTES], { type: 'image/png' }), `${smokeName}.png`);
    formData.set('category', args.label);
    formData.set('entityId', 'smoke');
    formData.set('slot', 'upload-delete');

    const uploadResponse = await fetch(`${baseUrl}/api/uploads/assets`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
    });
    const uploaded = await readJson(uploadResponse, 'OSS upload');

    if (!uploaded?.url || !uploaded?.objectKey) {
      throw new Error(`OSS upload response missing url/objectKey: ${JSON.stringify(uploaded)}`);
    }

    uploadedUrl = String(uploaded.url);
    console.log(`[PASS] Upload ok. objectKey=${uploaded.objectKey}`);

    const proxyResponse = await fetch(new URL(uploadedUrl, `${baseUrl}/`).toString(), {
      redirect: 'manual',
    });
    const proxyContentType = proxyResponse.headers.get('content-type') || '';

    if (![200, 206].includes(proxyResponse.status) || proxyResponse.type === 'opaqueredirect') {
      throw new Error(
        `OSS proxy stream check failed. status=${proxyResponse.status} content-type=${proxyContentType}`,
      );
    }

    const proxyBody = await proxyResponse.arrayBuffer();
    if (proxyBody.byteLength === 0) {
      throw new Error('OSS proxy stream returned an empty body');
    }

    console.log(`[PASS] Proxy stream ok. status=${proxyResponse.status} content-type=${proxyContentType}`);

    const deleteResponse = await fetch(`${baseUrl}/api/uploads/assets`, {
      method: 'DELETE',
      headers: {
        ...uploadHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: uploadedUrl }),
    });
    const deletePayload = await readJson(deleteResponse, 'OSS delete');

    if (!deletePayload?.success || deletePayload.deleted !== true) {
      throw new Error(`OSS delete did not confirm deletion: ${JSON.stringify(deletePayload)}`);
    }

    deleted = true;
    console.log('[PASS] Delete ok.');

    await assertHealth(baseUrl);
    console.log('[SUCCESS] OSS smoke passed.');
  } finally {
    if (uploadedUrl && !deleted) {
      try {
        await fetch(`${baseUrl}/api/uploads/assets`, {
          method: 'DELETE',
          headers: {
            ...uploadHeaders,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ url: uploadedUrl }),
        });
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
}

main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
