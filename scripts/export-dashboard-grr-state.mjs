import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { out: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--out') {
      args.out = argv[index + 1] || '';
      index += 1;
    }
  }
  return args;
}

function ensureEnvLoaded() {
  const envPath = path.join(repoRoot, '.env');
  const parsedEnv = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath, 'utf8')) : {};
  dotenv.config({ path: envPath });
  return parsedEnv;
}

function resolveOutputPath(rawOut) {
  if (!rawOut) {
    throw new Error('Missing required --out <path>');
  }
  return path.isAbsolute(rawOut) ? rawOut : path.resolve(process.cwd(), rawOut);
}

function readEnvValue(envMap, key, seen = new Set()) {
  const rawValue = (process.env[key] || envMap[key] || '').trim();
  if (!rawValue || seen.has(key)) return rawValue;

  return rawValue.replace(/\$\{([A-Z0-9_]+)\}/gi, (_match, referencedKey) => {
    return readEnvValue(envMap, referencedKey, new Set([...seen, key]));
  });
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

function resolveDatabase(envMap) {
  const configuredDatabaseUrl = readEnvValue(envMap, 'DATABASE_URL');
  const poolerConnectionString = readEnvValue(envMap, 'DATABASE_URL_POOLER');
  const directConnectionString = readEnvValue(envMap, 'DATABASE_URL_DIRECT');
  const pinnedHosts = parsePinnedHosts(readEnvValue(envMap, 'DATABASE_URL_POOLER_IPS'));

  let connectionString = configuredDatabaseUrl;
  let activePinnedHosts = [];
  const configuredHost = extractDbHost(configuredDatabaseUrl);

  if ((!configuredDatabaseUrl || !configuredHost || isSupabaseDirectHost(configuredHost)) && poolerConnectionString) {
    connectionString = poolerConnectionString;
    activePinnedHosts = pinnedHosts;
  } else if (!configuredDatabaseUrl && directConnectionString) {
    connectionString = directConnectionString;
  } else if (isSupabasePoolerHost(configuredHost)) {
    activePinnedHosts = pinnedHosts;
  }

  const resolvedHost = extractDbHost(connectionString);
  return {
    connectionString: buildPinnedConnectionString(connectionString, activePinnedHosts),
    resolvedHost,
    pinnedHosts: activePinnedHosts,
  };
}

async function exportDashboardGrrState() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = resolveOutputPath(args.out);
  const envMap = ensureEnvLoaded();

  const database = resolveDatabase(envMap);
  if (!database.connectionString) {
    throw new Error('DATABASE_URL is required to export dashboard GRR state');
  }

  const sql = postgres(database.connectionString, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    ssl:
      database.pinnedHosts.length > 0
        ? { rejectUnauthorized: false, servername: database.resolvedHost }
        : 'require',
  });

  try {
    const rows = await sql.unsafe(`
      SELECT workspace_key, state_json, updated_at
      FROM dashboard_grr_states_v1
      ORDER BY updated_at DESC, workspace_key ASC
    `);

    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      rowCount: rows.length,
      rows: rows.map((row) => ({
        workspaceKey: String(row.workspace_key || '').trim(),
        state: row.state_json ?? null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      })),
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[OK] Exported dashboard GRR state snapshot (${payload.rowCount} rows) -> ${outputPath}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

exportDashboardGrrState().catch((error) => {
  console.error('[ERR] Failed to export dashboard GRR state snapshot:', error);
  process.exit(1);
});
