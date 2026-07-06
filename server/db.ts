/**
 * Database Client — Supabase V3 PostgreSQL Connection
 *
 * Uses postgres.js (postgres) driver with Drizzle ORM.
 * Connection string is read from DATABASE_URL environment variable.
 *
 * 注意：dotenv 必须在本模块之前加载（由 server/index.ts 负责）。
 * 本模块不再自行调用 dotenv，避免 ESM hoisting 导致加载顺序问题。
 */

import './env.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema.js';

const configuredDatabaseUrl = process.env.DATABASE_URL;
const poolerConnectionString = process.env.DATABASE_URL_POOLER;
const directConnectionString = process.env.DATABASE_URL_DIRECT;
const parsedPoolMax = Number.parseInt(process.env.DB_POOL_MAX || '2', 10);
const poolMax = Number.isFinite(parsedPoolMax) ? Math.min(Math.max(parsedPoolMax, 1), 2) : 2;
const parsedConnectTimeout = Number.parseInt(process.env.DB_CONNECT_TIMEOUT_SECONDS || '10', 10);
const connectTimeoutSeconds = Number.isFinite(parsedConnectTimeout)
  ? Math.min(Math.max(parsedConnectTimeout, 5), 30)
  : 10;
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || process.env.VITEST === '1';
const isLocalDevRuntime =
  process.env.DEV_API === '1' ||
  (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test');

function extractDbHost(connectionString: string | undefined): string {
  if (!connectionString) return '';
  try {
    return new URL(connectionString).hostname;
  } catch {
    return '';
  }
}

function isSupabaseDirectHost(host: string): boolean {
  return /^db\./i.test(host) && /\.supabase\.co$/i.test(host);
}

function resolveDatabaseUrl(): { connectionString: string | undefined; source: string } {
  if (!configuredDatabaseUrl) {
    if (poolerConnectionString) {
      return { connectionString: poolerConnectionString, source: 'DATABASE_URL_POOLER fallback' };
    }
    if (directConnectionString) {
      return { connectionString: directConnectionString, source: 'DATABASE_URL_DIRECT fallback' };
    }
    return { connectionString: undefined, source: 'unset' };
  }

  const configuredHost = extractDbHost(configuredDatabaseUrl);
  const poolerHost = extractDbHost(poolerConnectionString);

  if (
    isLocalDevRuntime &&
    poolerConnectionString &&
    poolerHost &&
    isSupabaseDirectHost(configuredHost)
  ) {
    console.warn(
      `⚠️  Local dev detected direct Supabase host (${configuredHost}). ` +
      `Switching runtime DB connection to pooler host (${poolerHost}) to reduce local connectivity issues.`,
    );
    return { connectionString: poolerConnectionString, source: 'DATABASE_URL_POOLER preferred for local dev' };
  }

  return { connectionString: configuredDatabaseUrl, source: 'DATABASE_URL' };
}

const resolvedDatabase = resolveDatabaseUrl();
const connectionString = resolvedDatabase.connectionString;
const resolvedHost = extractDbHost(connectionString);

if (!connectionString && !isTestEnv) {
  console.warn(
    '⚠️  DATABASE_URL not set. Database operations will not be available.\n' +
      '   Set DATABASE_URL in your .env file to connect to Supabase V3.\n' +
      '   Example: DATABASE_URL=postgresql://postgres:password@host:port/postgres',
  );
} else if (connectionString && !isTestEnv) {
  console.log(`✅ Database runtime target: ${resolvedHost || 'unknown-host'} (${resolvedDatabase.source})`);
}

// Create postgres.js connection (lazy — only connects when queries run)
// Supabase 强制要求 SSL 连接，不加 ssl: 'require' 会导致连接永远挂起
const client = connectionString
  ? postgres(connectionString, {
      max: poolMax,         // Session mode 下收敛连接池，避免撞满数据库连接上限
      idle_timeout: 20,     // Close idle connections after 20s
      connect_timeout: connectTimeoutSeconds,
      ssl: 'require',       // ← Supabase 必须 SSL
    })
  : null;

// Create Drizzle ORM instance
export const db = client
  ? drizzle(client, { schema })
  : null;

// Export for direct SQL queries if needed
export { client as sql };

// Re-export schema for convenience
export { schema };
