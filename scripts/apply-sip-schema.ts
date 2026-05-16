import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured. Cannot apply SIP schema.');
}

const sqlFilePath = path.resolve(import.meta.dirname, './create-sip-schema.sql');
const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
const statements = sqlScript
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter(Boolean);

const client = postgres(connectionString, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  ssl: 'require',
});

async function main() {
  for (const statement of statements) {
    await client.unsafe(statement);
  }

  const [verification] = await client<{
    master_exists: string | null;
    details_exists: string | null;
  }[]>`
    SELECT
      to_regclass('public.sip_master')::text AS master_exists,
      to_regclass('public.sip_details')::text AS details_exists
  `;

  if (!verification?.master_exists || !verification?.details_exists) {
    throw new Error('SIP schema apply finished, but table verification failed.');
  }

  console.log('SIP schema applied successfully.');
  console.log(`Verified tables: ${verification.master_exists}, ${verification.details_exists}`);
}

main()
  .catch((error) => {
    console.error('Failed to apply SIP schema:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end({ timeout: 5 });
  });
