import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import postgres from 'postgres';

const REQUIRED_RELIABILITY_DROP = 0.15;

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://127.0.0.1:3000',
    moldId: '',
    moldNo: '',
    envFile: '.env',
    waitForDbReady: false,
    waitRetries: 90,
    waitIntervalMs: 1000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--base-url') {
      args.baseUrl = argv[index + 1] || args.baseUrl;
      index += 1;
      continue;
    }
    if (current === '--mold-id') {
      args.moldId = argv[index + 1] || args.moldId;
      index += 1;
      continue;
    }
    if (current === '--mold-no') {
      args.moldNo = argv[index + 1] || args.moldNo;
      index += 1;
      continue;
    }
    if (current === '--env-file') {
      args.envFile = argv[index + 1] || args.envFile;
      index += 1;
      continue;
    }
    if (current === '--wait-for-db-ready') {
      args.waitForDbReady = true;
      continue;
    }
    if (current === '--wait-retries') {
      args.waitRetries = Number(argv[index + 1] || args.waitRetries);
      index += 1;
      continue;
    }
    if (current === '--wait-interval-ms') {
      args.waitIntervalMs = Number(argv[index + 1] || args.waitIntervalMs);
      index += 1;
    }
  }

  return args;
}

function buildSmokeIdentity() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const token = crypto.randomUUID().slice(0, 8);
  return {
    moldId: `FRACAS-SMOKE-ASSET-${timestamp}-${token}`,
    moldNo: `NO. SMOKE ${timestamp}-${token}`,
  };
}

async function readJson(url, init = undefined) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${url}`);
  }
  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readHealthPayload(baseUrl) {
  return readJson(`${baseUrl}/api/health`);
}

async function waitForDbReady(baseUrl, retries, intervalMs) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const payload = await readHealthPayload(baseUrl);

    if (payload?.warmup?.phase === 'failed') {
      throw new Error(`DB warmup failed before reliability smoke could start: ${JSON.stringify(payload)}`);
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

function readNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseEnvFile(filePath) {
  const envMap = new Map();
  if (!fs.existsSync(filePath)) {
    return envMap;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    envMap.set(key, value);
  }

  return envMap;
}

function readEnvValue(envMap, key) {
  return (process.env[key] || envMap.get(key) || '').trim();
}

function extractDbHost(connectionString) {
  if (!connectionString) return '';
  try {
    return new URL(connectionString).hostname;
  } catch {
    return '';
  }
}

function isSupabaseDirectHost(host) {
  return /^db\./i.test(host) && /\.supabase\.co$/i.test(host);
}

function isSupabasePoolerHost(host) {
  return /\.pooler\.supabase\.com$/i.test(host);
}

function parsePinnedHosts(value) {
  if (!value) return [];

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hostPart, portPart] = entry.split(':');
      const parsedPort = Number.parseInt(portPart || '5432', 10);
      return {
        host: hostPart.trim(),
        port: Number.isFinite(parsedPort) ? parsedPort : 5432,
      };
    })
    .filter((entry) => entry.host);
}

function buildPinnedConnectionString(baseConnectionString, pinnedHosts) {
  if (!baseConnectionString || pinnedHosts.length === 0) return baseConnectionString;

  try {
    const parsedUrl = new URL(baseConnectionString);
    const hostSegment = pinnedHosts.map((entry) => `${entry.host}:${entry.port}`).join(',');
    return baseConnectionString.replace(parsedUrl.host, hostSegment);
  } catch {
    return baseConnectionString;
  }
}

function resolveSmokeDatabase(envMap) {
  const configuredDatabaseUrl = readEnvValue(envMap, 'DATABASE_URL');
  const poolerConnectionString = readEnvValue(envMap, 'DATABASE_URL_POOLER');
  const directConnectionString = readEnvValue(envMap, 'DATABASE_URL_DIRECT');
  const pinnedHosts = parsePinnedHosts(readEnvValue(envMap, 'DATABASE_URL_POOLER_IPS'));

  let connectionString = configuredDatabaseUrl;
  let source = 'DATABASE_URL';
  let activePinnedHosts = [];

  const configuredHost = extractDbHost(configuredDatabaseUrl);
  const poolerHost = extractDbHost(poolerConnectionString);
  if (
    (
      !configuredDatabaseUrl
      || !configuredHost
      || (poolerConnectionString && isSupabaseDirectHost(configuredHost))
    )
    && poolerConnectionString
  ) {
    connectionString = poolerConnectionString;
    source = configuredDatabaseUrl
      ? 'DATABASE_URL_POOLER preferred for local smoke'
      : 'DATABASE_URL_POOLER fallback';
    activePinnedHosts = pinnedHosts;
  } else if (!configuredDatabaseUrl && directConnectionString) {
    connectionString = directConnectionString;
    source = 'DATABASE_URL_DIRECT fallback';
  } else if (isSupabasePoolerHost(configuredHost)) {
    activePinnedHosts = pinnedHosts;
  }

  const resolvedHost = extractDbHost(connectionString);
  return {
    connectionString: buildPinnedConnectionString(connectionString, activePinnedHosts),
    source,
    resolvedHost,
    pinnedHosts: activePinnedHosts,
  };
}

function resolveApiKey(args, envFilePath) {
  const envMap = parseEnvFile(envFilePath);
  return (
    args.apiKey
    || process.env.API_SECRET_KEY
    || envMap.get('API_SECRET_KEY')?.trim()
    || ''
  );
}

async function postFailureEvent(args, currentShots, recoveryRating, ordinal, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  return readJson(`${args.baseUrl}/api/reliability/event`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      moldId: args.moldId,
      moldNo: args.moldNo,
      type: 'SICKNESS',
      currentShots,
      recoveryRating,
      downtimeHours: 12 + ordinal,
      cost: 9999 + ordinal,
      operator: 'smoke',
      symptom: `Smoke severe failure #${ordinal}`,
      diagnosis: `Smoke severe failure #${ordinal}`,
      procedure: `Smoke severe failure write path #${ordinal}`,
    }),
  });
}

async function queryStoredMetrics(database, moldId) {
  const sql = postgres(database.connectionString, {
    ssl:
      database.pinnedHosts.length > 0
        ? { rejectUnauthorized: false, servername: database.resolvedHost }
        : 'require',
    max: 1,
  });
  try {
    const rows = await sql.unsafe(
      `
        SELECT reliability_metrics AS "reliabilityMetrics"
        FROM projects
        WHERE id = $1 OR mold_number = $1
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      `,
      [moldId],
    );

    const row = rows[0];
    return row?.reliabilityMetrics ?? null;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const smokeIdentity = buildSmokeIdentity();
  if (!args.moldId) {
    args.moldId = smokeIdentity.moldId;
  }
  if (!args.moldNo) {
    args.moldNo = smokeIdentity.moldNo;
  }
  console.log(`[INFO] Reliability smoke started. baseUrl=${args.baseUrl} moldId=${args.moldId}`);

  const envFilePath = path.resolve(process.cwd(), args.envFile);
  const apiKey = resolveApiKey(args, envFilePath);
  if (apiKey) {
    console.log('[INFO] Reliability smoke auth header enabled.');
  } else {
    console.log('[INFO] Reliability smoke auth header skipped.');
  }

  if (args.waitForDbReady) {
    await waitForDbReady(args.baseUrl, args.waitRetries, args.waitIntervalMs);
  }

  const apiHeaders = apiKey ? { 'x-api-key': apiKey } : {};

  const before = await readJson(
    `${args.baseUrl}/api/dashboard/stats/${encodeURIComponent(args.moldId)}?moldNo=${encodeURIComponent(args.moldNo)}`,
    { headers: apiHeaders },
  );
  const beforeMetrics = before?.reliability ?? {};
  const beforeReliability = readNumber(beforeMetrics.currentReliability, 0);
  const beforeBeta = readNumber(beforeMetrics.beta, 0);
  const beforeCurrentShots = readNumber(beforeMetrics.currentShots, 250000);
  const currentEta = readNumber(beforeMetrics.eta, readNumber(beforeMetrics.theoreticalEta, 1000000));
  const severeStartShots = Math.max(beforeCurrentShots + 1000, Math.floor(currentEta * 0.82));

  for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
    await postFailureEvent(args, severeStartShots + ordinal * 250, 0.2, ordinal, apiKey);
  }

  const after = await readJson(
    `${args.baseUrl}/api/dashboard/stats/${encodeURIComponent(args.moldId)}?moldNo=${encodeURIComponent(args.moldNo)}`,
    { headers: apiHeaders },
  );
  const afterMetrics = after?.reliability ?? {};
  const afterReliability = readNumber(afterMetrics.currentReliability, 0);
  const afterBeta = readNumber(afterMetrics.beta, 0);
  const reliabilityDrop = beforeReliability - afterReliability;

  console.log(
    `[INFO] Reliability before=${beforeReliability.toFixed(6)} after=${afterReliability.toFixed(6)} drop=${reliabilityDrop.toFixed(6)}`,
  );
  console.log(`[INFO] Beta before=${beforeBeta.toFixed(4)} after=${afterBeta.toFixed(4)}`);

  if (!(reliabilityDrop > REQUIRED_RELIABILITY_DROP)) {
    throw new Error(
      `Reliability smoke failed: engine desensitized. Expected R(t) drop > ${REQUIRED_RELIABILITY_DROP}, got ${reliabilityDrop.toFixed(6)}.`,
    );
  }

  const envMap = parseEnvFile(envFilePath);
  const database = resolveSmokeDatabase(envMap);
  if (!database.connectionString) {
    throw new Error(`Reliability smoke failed: DATABASE_URL missing in ${envFilePath}.`);
  }
  console.log(`[INFO] Reliability DB target=${database.resolvedHost || 'unknown-host'} (${database.source})`);

  const storedMetrics = await queryStoredMetrics(database, args.moldId);
  const storedBeta = readNumber(storedMetrics?.beta, 0);
  if (!(storedBeta > beforeBeta)) {
    throw new Error(
      `Reliability smoke failed: stored beta did not accumulate. before=${beforeBeta.toFixed(4)} stored=${storedBeta.toFixed(4)}.`,
    );
  }

  console.log(`[INFO] Stored beta=${storedBeta.toFixed(4)} validated in projects.reliability_metrics`);
  console.log('[SUCCESS] Reliability smoke passed.');
}

main().catch((error) => {
  console.error('[FAIL]', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
