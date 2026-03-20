import '../server/env.js';

import path from 'path';
import type { ParameterOrJSON } from 'postgres';
import { sql as dbSql } from '../server/db.js';
import { uploadAssetToOss } from '../server/lib/oss.js';

type ColumnMeta = {
  schema: string;
  table: string;
  column: string;
  dataType: string;
};

type TableGroup = {
  schema: string;
  table: string;
  columns: ColumnMeta[];
};

type MigrationStats = {
  tablesScanned: number;
  rowsMatched: number;
  rowsUpdated: number;
  columnsUpdated: number;
  urlsDetected: number;
  urlsMigrated: number;
  urlCacheHits: number;
  skippedTablesWithoutPk: number;
};

const SUPABASE_URL_FRAGMENT = 'supabase.co/storage';
const SUPABASE_URL_LIKE = `%${SUPABASE_URL_FRAGMENT}%`;

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toKey(schema: string, table: string): string {
  return `${schema}.${table}`;
}

function parseArgs(argv: string[]) {
  const flags = new Set(argv);
  const isApply = flags.has('--apply');
  return {
    isApply,
    dryRun: !isApply,
  };
}

function extractUrlsFromText(text: string): string[] {
  const found = new Set<string>();
  const matches = text.matchAll(/https?:\/\/[^\s"'<>]+/g);

  for (const match of matches) {
    const raw = match[0];
    const trimmed = raw.replace(/[),.;]+$/g, '');
    if (!trimmed.includes(SUPABASE_URL_FRAGMENT)) {
      continue;
    }

    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname.includes('supabase.co')) {
        continue;
      }
      if (!parsed.pathname.includes('/storage/')) {
        continue;
      }
      found.add(trimmed);
    } catch {
      continue;
    }
  }

  return [...found];
}

function collectSupabaseUrls(input: unknown): string[] {
  const urls = new Set<string>();

  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      for (const url of extractUrlsFromText(value)) {
        urls.add(url);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }

    if (value && typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        visit(nested);
      }
    }
  };

  visit(input);
  return [...urls];
}

function replaceUrlsInString(text: string, mapping: Map<string, string>): string {
  let output = text;
  const orderedOldUrls = [...mapping.keys()].sort((a, b) => b.length - a.length);

  for (const oldUrl of orderedOldUrls) {
    const nextUrl = mapping.get(oldUrl);
    if (!nextUrl) continue;
    output = output.split(oldUrl).join(nextUrl);
  }

  return output;
}

function deepReplaceUrls(input: unknown, mapping: Map<string, string>): unknown {
  if (typeof input === 'string') {
    return replaceUrlsInString(input, mapping);
  }

  if (Array.isArray(input)) {
    return input.map((entry) => deepReplaceUrls(entry, mapping));
  }

  if (input && typeof input === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      next[key] = deepReplaceUrls(value, mapping);
    }
    return next;
  }

  return input;
}

function inferFilenameFromUrl(assetUrl: string, contentType: string | null): string {
  try {
    const parsed = new URL(assetUrl);
    const basename = path.basename(parsed.pathname) || 'asset';
    const decoded = decodeURIComponent(basename);
    if (decoded && decoded !== '/') {
      return decoded;
    }
  } catch {
    // Fall through to mime-based name.
  }

  const ext = (() => {
    if (!contentType) return '';
    const baseType = contentType.split(';')[0].trim().toLowerCase();
    if (baseType === 'image/jpeg') return '.jpg';
    if (baseType === 'image/png') return '.png';
    if (baseType === 'image/webp') return '.webp';
    if (baseType === 'image/gif') return '.gif';
    if (baseType === 'image/svg+xml') return '.svg';
    return '';
  })();

  return `asset${ext}`;
}

async function fetchColumns(): Promise<ColumnMeta[]> {
  if (!dbSql) {
    throw new Error('DATABASE_URL not configured. Aborting migration.');
  }

  const rows = await dbSql.unsafe(
    `
      SELECT
        table_schema AS schema,
        table_name AS table,
        column_name AS column,
        data_type AS "dataType"
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND data_type IN ('text', 'character varying', 'json', 'jsonb')
      ORDER BY table_schema, table_name, ordinal_position
    `,
  ) as ColumnMeta[];

  return rows;
}

async function fetchPrimaryKeyColumns(schema: string, table: string): Promise<string[]> {
  if (!dbSql) {
    return [];
  }

  const rows = await dbSql.unsafe(
    `
      SELECT kcu.column_name AS column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY kcu.ordinal_position
    `,
    [schema, table],
  ) as Array<{ column: string }>;

  return rows.map((item) => item.column);
}

function groupColumnsByTable(columns: ColumnMeta[]): TableGroup[] {
  const groups = new Map<string, TableGroup>();

  for (const column of columns) {
    const key = toKey(column.schema, column.table);
    const existing = groups.get(key);
    if (existing) {
      existing.columns.push(column);
      continue;
    }

    groups.set(key, {
      schema: column.schema,
      table: column.table,
      columns: [column],
    });
  }

  return [...groups.values()];
}

async function run() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  if (!dbSql) {
    throw new Error('DATABASE_URL not configured. Migration cannot run.');
  }

  const stats: MigrationStats = {
    tablesScanned: 0,
    rowsMatched: 0,
    rowsUpdated: 0,
    columnsUpdated: 0,
    urlsDetected: 0,
    urlsMigrated: 0,
    urlCacheHits: 0,
    skippedTablesWithoutPk: 0,
  };

  const columns = await fetchColumns();
  const tableGroups = groupColumnsByTable(columns);
  const migratedUrlMap = new Map<string, string>();

  console.log(`[cutover] Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`[cutover] Candidate tables: ${tableGroups.length}`);

  for (const group of tableGroups) {
    stats.tablesScanned += 1;

    const pkColumns = await fetchPrimaryKeyColumns(group.schema, group.table);
    if (pkColumns.length === 0) {
      stats.skippedTablesWithoutPk += 1;
      continue;
    }

    const fqTable = `${quoteIdent(group.schema)}.${quoteIdent(group.table)}`;
    const selectColumns = [...pkColumns, ...group.columns.map((c) => c.column)];
    const uniqueSelectColumns = [...new Set(selectColumns)];
    const selectSql = uniqueSelectColumns.map(quoteIdent).join(', ');
    const whereSql = group.columns
      .map((column) => `${quoteIdent(column.column)}::text ILIKE $1`)
      .join(' OR ');

    const rows = await dbSql.unsafe(
      `SELECT ${selectSql} FROM ${fqTable} WHERE ${whereSql}`,
      [SUPABASE_URL_LIKE],
    ) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      continue;
    }

    stats.rowsMatched += rows.length;
    console.log(`[cutover] ${group.schema}.${group.table} matched rows: ${rows.length}`);

    for (const row of rows) {
      const perRowChanges = new Map<string, unknown>();

      for (const column of group.columns) {
        const originalValue = row[column.column];
        const urls = collectSupabaseUrls(originalValue);
        if (urls.length === 0) {
          continue;
        }

        stats.urlsDetected += urls.length;
        const replaceMap = new Map<string, string>();

        for (const oldUrl of urls) {
          const cached = migratedUrlMap.get(oldUrl);
          if (cached) {
            replaceMap.set(oldUrl, cached);
            stats.urlCacheHits += 1;
            continue;
          }

          const response = await fetch(oldUrl);
          if (!response.ok) {
            throw new Error(`[cutover] Download failed (${response.status}) for ${oldUrl}`);
          }

          const contentType = response.headers.get('content-type');
          const arrayBuffer = await response.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);
          const filename = inferFilenameFromUrl(oldUrl, contentType);

          const uploaded = await uploadAssetToOss({
            fileBuffer,
            filename,
            mimeType: contentType || 'application/octet-stream',
            category: 'supabase-storage-cutover',
            entityId: `${group.schema}.${group.table}`,
            slot: column.column,
          });

          migratedUrlMap.set(oldUrl, uploaded.url);
          replaceMap.set(oldUrl, uploaded.url);
          stats.urlsMigrated += 1;
        }

        const nextValue = deepReplaceUrls(originalValue, replaceMap);
        const before = JSON.stringify(originalValue);
        const after = JSON.stringify(nextValue);
        if (before !== after) {
          perRowChanges.set(column.column, nextValue);
        }
      }

      if (perRowChanges.size === 0) {
        continue;
      }

      stats.columnsUpdated += perRowChanges.size;

      const pkDescriptor = pkColumns
        .map((pk) => `${pk}=${JSON.stringify(row[pk])}`)
        .join(', ');

      if (dryRun) {
        console.log(`[cutover][dry-run] would update ${group.schema}.${group.table} (${pkDescriptor}) columns: ${[...perRowChanges.keys()].join(', ')}`);
        continue;
      }

      const assignments: string[] = [];
      const values: ParameterOrJSON<never>[] = [];
      let index = 1;

      for (const [columnName, columnValue] of perRowChanges.entries()) {
        const columnMeta = group.columns.find((column) => column.column === columnName);
        if (!columnMeta) {
          continue;
        }

        const isJsonLike = columnMeta.dataType === 'json' || columnMeta.dataType === 'jsonb';
        assignments.push(
          `${quoteIdent(columnName)} = $${index}${isJsonLike ? `::${columnMeta.dataType}` : ''}`,
        );
        values.push((isJsonLike ? JSON.stringify(columnValue) : columnValue) as ParameterOrJSON<never>);
        index += 1;
      }

      const whereClauses = pkColumns.map((pk) => {
        const clause = `${quoteIdent(pk)} = $${index}`;
        values.push(row[pk] as ParameterOrJSON<never>);
        index += 1;
        return clause;
      });

      await dbSql.unsafe(
        `UPDATE ${fqTable} SET ${assignments.join(', ')} WHERE ${whereClauses.join(' AND ')}`,
        values,
      );

      stats.rowsUpdated += 1;
      console.log(`[cutover][apply] updated ${group.schema}.${group.table} (${pkDescriptor})`);
    }
  }

  console.log('[cutover] Done.');
  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'apply',
        ...stats,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('[cutover] Migration failed:', error);
  process.exit(1);
});
