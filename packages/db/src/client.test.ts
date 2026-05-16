import { afterEach, describe, expect, it } from 'vitest';
import { type ClientHandle, openDb, reverseMigrations, runMigrations } from './client.ts';

let handle: ClientHandle | null = null;
afterEach(async () => {
  if (handle) {
    await handle.close();
    handle = null;
  }
});

describe('client + migrations', () => {
  it('opens a pglite client and applies migrations', async () => {
    handle = await openDb();
    expect(handle.driver).toBe('pglite');
    const applied = await runMigrations(handle);
    expect(applied.length).toBeGreaterThan(0);
    // Sanity: workspaces table exists.
    await handle.exec(`INSERT INTO workspaces (name) VALUES ('TestWS');`);
  });

  it('reverse + apply is idempotent', async () => {
    handle = await openDb();
    await runMigrations(handle);
    await reverseMigrations(handle);
    const applied = await runMigrations(handle);
    expect(applied.length).toBeGreaterThan(0);
    await handle.exec(`INSERT INTO workspaces (name) VALUES ('After reset');`);
  });
});
