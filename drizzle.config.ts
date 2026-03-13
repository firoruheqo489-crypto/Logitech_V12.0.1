/**
 * Drizzle Kit Configuration — Supabase V3 Schema Push
 *
 * Usage:
 *   pnpm db:push    — Push schema to Supabase
 *   pnpm db:studio  — Open Drizzle Studio
 */

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
  verbose: true,
  strict: true,
});
