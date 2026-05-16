#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';

const ROOT = process.cwd();
const DOCS_ROOT = join(ROOT, 'docs');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
let broken = 0;
let total = 0;

for (const file of walk(DOCS_ROOT)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(linkRe)) {
    const raw = match[1].split('#')[0];
    if (!raw || /^(https?:|mailto:)/.test(raw)) continue;
    total += 1;
    const resolved = normalize(resolve(dirname(file), raw));
    try {
      statSync(resolved);
    } catch {
      console.error(`BROKEN: ${file} → ${raw}`);
      broken += 1;
    }
  }
}

console.log(`link_check: links=${total} broken=${broken}`);
if (broken > 0) process.exit(1);
