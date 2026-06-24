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
  dotenv.config({ path: envPath });
  return envPath;
}

function resolveOutputPath(rawOut) {
  if (!rawOut) {
    throw new Error('Missing required --out <path>');
  }
  return path.isAbsolute(rawOut) ? rawOut : path.resolve(process.cwd(), rawOut);
}

async function exportDashboardGrrState() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = resolveOutputPath(args.out);
  ensureEnvLoaded();

  const connectionString = process.env.DATABASE_URL || '';
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to export dashboard GRR state');
  }

  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    ssl: 'require',
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
