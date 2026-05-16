import { openDb, reverseMigrations, runMigrations } from '../src/client.ts';

const handle = await openDb();
console.log(`[reset] driver=${handle.driver}`);
const reversed = await reverseMigrations(handle);
for (const f of reversed) console.log(`[reset] reversed ${f}`);
const applied = await runMigrations(handle);
for (const f of applied) console.log(`[reset] applied ${f}`);
await handle.close();
