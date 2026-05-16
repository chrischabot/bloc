import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { type PgliteDatabase, drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { type PostgresJsDatabase, drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export type Schema = typeof schema;
export type Database = PgliteDatabase<Schema> | PostgresJsDatabase<Schema>;

export interface ClientHandle {
  db: Database;
  /** Run a raw SQL string (used by migration runner). */
  exec: (sql: string) => Promise<void>;
  /** Close the underlying driver. */
  close: () => Promise<void>;
  /** Which driver is in use. */
  driver: 'pglite' | 'postgres';
}

/**
 * Open a database connection. If `dataDir` is provided (or `DATABASE_URL`
 * is `pglite://<path>`), uses PGlite. If `DATABASE_URL` starts with `postgres://`
 * or `postgresql://`, uses postgres-js. Defaults to an in-memory PGlite instance.
 */
export async function openDb(options?: {
  url?: string;
  dataDir?: string;
}): Promise<ClientHandle> {
  const url = options?.url ?? process.env['DATABASE_URL'] ?? '';

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const client = postgres(url, { max: 10 });
    const db = drizzlePostgres(client, { schema });
    return {
      db,
      exec: async (sqlText) => {
        await client.unsafe(sqlText);
      },
      close: async () => {
        await client.end();
      },
      driver: 'postgres',
    };
  }

  // PGlite — in-memory by default, or persistent if a path is given.
  const dataDir =
    options?.dataDir ?? (url.startsWith('pglite://') ? url.slice('pglite://'.length) : undefined);
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  const db = drizzlePglite(pg, { schema });
  return {
    db,
    exec: async (sqlText) => {
      await pg.exec(sqlText);
    },
    close: async () => {
      await pg.close();
    },
    driver: 'pglite',
  };
}

/** Run every `*.sql` migration in order (ignores `.down.sql`). */
export async function runMigrations(handle: ClientHandle): Promise<string[]> {
  const all = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();
  for (const file of all) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await handle.exec(sqlText);
  }
  return all;
}

/** Drop everything (runs the .down.sql migrations in reverse order). */
export async function reverseMigrations(handle: ClientHandle): Promise<string[]> {
  const all = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.down.sql'))
    .sort()
    .reverse();
  for (const file of all) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await handle.exec(sqlText);
  }
  return all;
}

export { schema };
