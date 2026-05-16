import { openDb, runMigrations } from '../src/client.ts';

const handle = await openDb();
console.log(`[migrate] driver=${handle.driver}`);
const applied = await runMigrations(handle);
for (const f of applied) console.log(`[migrate] applied ${f}`);
await handle.close();
