import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const TABLE_NAME = 'dashboard_grr_states_v1';

function parseArgs(argv) {
  const args = { file: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--file') {
      args.file = argv[index + 1] || '';
      index += 1;
    }
  }
  return args;
}

function resolveSnapshotPath(rawPath) {
  if (!rawPath) {
    throw new Error('Missing required --file <path>');
  }
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

function ensureEnvLoaded() {
  const envPath = path.join(repoRoot, '.env');
  const parsedEnv = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath, 'utf8')) : {};
  dotenv.config({ path: envPath });
  return parsedEnv;
}

function normalizeRows(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return null;
      }
      const workspaceKey = String(row.workspaceKey || '').trim();
      if (!workspaceKey) {
        return null;
      }
      return {
        workspaceKey,
        state: row.state ?? null,
        updatedAt: row.updatedAt ? new Date(String(row.updatedAt)).toISOString() : new Date().toISOString(),
      };
    })
    .filter(Boolean);
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

async function ensureTable(sql) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      workspace_key VARCHAR(120) PRIMARY KEY,
      state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function importDashboardGrrState() {
  const args = parseArgs(process.argv.slice(2));
  const snapshotPath = resolveSnapshotPath(args.file);

  if (!fs.existsSync(snapshotPath)) {
    console.log(`[INFO] Dashboard GRR snapshot not found, skipping import: ${snapshotPath}`);
    return;
  }

  const envMap = ensureEnvLoaded();
  const database = resolveDatabase(envMap);
  if (!database.connectionString) {
    throw new Error('DATABASE_URL is required to import dashboard GRR state');
  }

  const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const rows = normalizeRows(payload);
  if (rows.length === 0) {
    console.log('[INFO] Dashboard GRR snapshot is empty, nothing to import.');
    return;
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
    await ensureTable(sql);
    for (const row of rows) {
      await sql.unsafe(
        `
          INSERT INTO ${TABLE_NAME} (
            workspace_key,
            state_json,
            created_at,
            updated_at
          ) VALUES ($1, $2::jsonb, NOW(), $3::timestamp)
          ON CONFLICT (workspace_key)
          DO UPDATE SET
            state_json = EXCLUDED.state_json,
            updated_at = EXCLUDED.updated_at
        `,
        [row.workspaceKey, JSON.stringify(row.state ?? {}), row.updatedAt],
      );
    }

    console.log(`[OK] Imported dashboard GRR state snapshot (${rows.length} rows) from ${snapshotPath}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

importDashboardGrrState().catch((error) => {
  console.error('[ERR] Failed to import dashboard GRR state snapshot:', error);
  process.exit(1);
});
