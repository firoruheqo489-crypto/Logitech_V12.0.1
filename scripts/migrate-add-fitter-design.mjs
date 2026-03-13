/**
 * One-time migration: add fitter_group and design_engineer columns to dashboard_projects
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = path.resolve(__dirname, '../.env');
try {
  const env = readFileSync(envPath, 'utf-8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch (_) {}

const { default: postgres } = await import('postgres');

const db = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

try {
  await db`ALTER TABLE dashboard_projects ADD COLUMN IF NOT EXISTS fitter_group varchar(255)`;
  console.log('✅ fitter_group column added (or already exists)');
  await db`ALTER TABLE dashboard_projects ADD COLUMN IF NOT EXISTS design_engineer varchar(255)`;
  console.log('✅ design_engineer column added (or already exists)');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  await db.end();
}
