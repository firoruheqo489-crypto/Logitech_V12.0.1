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
  dotenv.config({ path: envPath });
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

  ensureEnvLoaded();
  const connectionString = process.env.DATABASE_URL || '';
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to import dashboard GRR state');
  }

  const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const rows = normalizeRows(payload);
  if (rows.length === 0) {
    console.log('[INFO] Dashboard GRR snapshot is empty, nothing to import.');
    return;
  }

  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    ssl: 'require',
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
