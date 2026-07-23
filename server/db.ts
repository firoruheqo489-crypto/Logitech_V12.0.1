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

type PinnedHost = { host: string; port: number };

const configuredDatabaseUrl = process.env.DATABASE_URL;
const poolerConnectionString = process.env.DATABASE_URL_POOLER;
const directConnectionString = process.env.DATABASE_URL_DIRECT;
const poolerPinnedHostsRaw = process.env.DATABASE_URL_POOLER_IPS;
const parsedPoolMax = Number.parseInt(process.env.DB_POOL_MAX || '2', 10);
const poolMax = Number.isFinite(parsedPoolMax) ? Math.min(Math.max(parsedPoolMax, 1), 2) : 2;
const parsedIdleTimeout = Number.parseInt(process.env.DB_IDLE_TIMEOUT_SECONDS || '600', 10);
const idleTimeoutSeconds = Number.isFinite(parsedIdleTimeout)
  ? Math.min(Math.max(parsedIdleTimeout, 30), 1_800)
  : 600;
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

function parsePinnedHosts(value: string | undefined): PinnedHost[] {
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

function isSupabasePoolerHost(host: string): boolean {
  return /\.pooler\.supabase\.com$/i.test(host);
}

function buildPinnedConnectionString(
  baseConnectionString: string | undefined,
  pinnedHosts: PinnedHost[],
): string | undefined {
  if (!baseConnectionString || pinnedHosts.length === 0) return baseConnectionString;

  try {
    const parsedUrl = new URL(baseConnectionString);
    const hostSegment = pinnedHosts.map((entry) => `${entry.host}:${entry.port}`).join(',');
    return baseConnectionString.replace(parsedUrl.host, hostSegment);
  } catch {
    return baseConnectionString;
  }
}

function resolveDatabaseUrl(): { connectionString: string | undefined; source: string; pinnedHosts: PinnedHost[] } {
  const pinnedHosts = parsePinnedHosts(poolerPinnedHostsRaw);

  if (!configuredDatabaseUrl) {
    if (poolerConnectionString) {
      return { connectionString: poolerConnectionString, source: 'DATABASE_URL_POOLER fallback', pinnedHosts };
    }
    if (directConnectionString) {
      return { connectionString: directConnectionString, source: 'DATABASE_URL_DIRECT fallback', pinnedHosts: [] };
    }
    return { connectionString: undefined, source: 'unset', pinnedHosts: [] };
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
    return {
      connectionString: poolerConnectionString,
      source: 'DATABASE_URL_POOLER preferred for local dev',
      pinnedHosts,
    };
  }

  return {
    connectionString: configuredDatabaseUrl,
    source: 'DATABASE_URL',
    pinnedHosts: isLocalDevRuntime && isSupabasePoolerHost(configuredHost) ? pinnedHosts : [],
  };
}

const resolvedDatabase = resolveDatabaseUrl();
const pinnedRuntimeHosts = resolvedDatabase.pinnedHosts;
const runtimeConnectionString = buildPinnedConnectionString(resolvedDatabase.connectionString, pinnedRuntimeHosts);
const connectionString = runtimeConnectionString;
const resolvedHost = extractDbHost(resolvedDatabase.connectionString);

if (!connectionString && !isTestEnv) {
  console.warn(
    '⚠️  DATABASE_URL not set. Database operations will not be available.\n' +
      '   Set DATABASE_URL in your .env file to connect to Supabase V3.\n' +
      '   Example: DATABASE_URL=postgresql://postgres:password@host:port/postgres',
  );
} else if (connectionString && !isTestEnv) {
  console.log(`✅ Database runtime target: ${resolvedHost || 'unknown-host'} (${resolvedDatabase.source})`);
  if (pinnedRuntimeHosts.length > 0) {
    console.log(
      `🔒 Local dev DNS fallback active for ${resolvedHost}: ${pinnedRuntimeHosts
        .map((entry) => `${entry.host}:${entry.port}`)
        .join(', ')}`,
    );
  }
}

// Create postgres.js connection (lazy — only connects when queries run)
// Supabase 强制要求 SSL 连接，不加 ssl: 'require' 会导致连接永远挂起
const client = connectionString
  ? postgres(connectionString, {
      max: poolMax,         // Session mode 下收敛连接池，避免撞满数据库连接上限
      idle_timeout: idleTimeoutSeconds,
      connect_timeout: connectTimeoutSeconds,
      ssl:
        pinnedRuntimeHosts.length > 0
          ? { rejectUnauthorized: false, servername: resolvedHost }
          : 'require',       // ← Supabase 必须 SSL
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
