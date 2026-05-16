import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { integrations } from '../schema/workspaces.ts';

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;

const TOKEN_PREFIX = 'secret_';
const TOKEN_BYTES = 32; // -> 43 URL-safe base64 chars
const BCRYPT_COST = 10;
const PREFIX_INDEX_LEN = TOKEN_PREFIX.length + 16;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 1000;

interface CacheEntry {
  integration: Integration;
  expiresAt: number;
}
const VERIFY_CACHE = new Map<string, CacheEntry>();

function cacheGet(rawToken: string): Integration | null {
  const entry = VERIFY_CACHE.get(rawToken);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    VERIFY_CACHE.delete(rawToken);
    return null;
  }
  return entry.integration;
}

function cacheSet(rawToken: string, integration: Integration): void {
  if (VERIFY_CACHE.size >= CACHE_MAX) {
    const first = VERIFY_CACHE.keys().next().value;
    if (first !== undefined) VERIFY_CACHE.delete(first);
  }
  VERIFY_CACHE.set(rawToken, {
    integration,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function cacheInvalidateById(integrationId: string): void {
  for (const [k, v] of VERIFY_CACHE) {
    if (v.integration.id === integrationId) VERIFY_CACHE.delete(k);
  }
}

/** Reset the verify cache (for tests). */
export function resetIntegrationVerifyCache(): void {
  VERIFY_CACHE.clear();
}

/**
 * Generate a fresh integration token. Returns the raw token (shown once to the
 * caller), the bcrypt hash for at-rest storage, and the indexed prefix used
 * for candidate lookup before bcrypt verification.
 */
export async function generateToken(): Promise<{ raw: string; hash: string; prefix: string }> {
  const body = randomBytes(TOKEN_BYTES).toString('base64url');
  const raw = `${TOKEN_PREFIX}${body}`;
  const hashed = await bcrypt.hash(raw, BCRYPT_COST);
  const prefix = raw.slice(0, PREFIX_INDEX_LEN);
  return { raw, hash: hashed, prefix };
}

export interface CreateIntegrationInput {
  workspaceId: string;
  ownerUserId: string;
  name: string;
  capabilities: string[];
}

export async function createIntegration(
  db: Database,
  input: CreateIntegrationInput,
): Promise<{ integration: Integration; token: string }> {
  const { raw, hash: tokenHash, prefix } = await generateToken();
  const [row] = await db
    .insert(integrations)
    .values({
      workspaceId: input.workspaceId,
      ownerUserId: input.ownerUserId,
      name: input.name,
      tokenHash,
      tokenPrefix: prefix,
      capabilities: JSON.stringify(input.capabilities),
    })
    .returning();
  if (!row) throw new Error('createIntegration: empty insert');
  return { integration: row, token: raw };
}

/**
 * Look up an integration by raw bearer token. Cached for 60s after first
 * successful bcrypt verification; revoked tokens evict the cache entry.
 *
 * Lookup path: 16-char prefix indexed query → bcrypt.compare per candidate.
 */
export async function findIntegrationByToken(
  db: Database,
  rawToken: string,
): Promise<Integration | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX) || rawToken.length < PREFIX_INDEX_LEN) {
    return null;
  }
  const cached = cacheGet(rawToken);
  if (cached !== null) return cached;

  const prefix = rawToken.slice(0, PREFIX_INDEX_LEN);
  const candidates = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tokenPrefix, prefix), isNull(integrations.revokedAt)));
  for (const candidate of candidates) {
    if (await bcrypt.compare(rawToken, candidate.tokenHash)) {
      cacheSet(rawToken, candidate);
      return candidate;
    }
  }
  return null;
}

export async function listIntegrationsByOwner(
  db: Database,
  ownerUserId: string,
): Promise<Integration[]> {
  return db
    .select()
    .from(integrations)
    .where(eq(integrations.ownerUserId, ownerUserId))
    .orderBy(desc(integrations.createdAt));
}

export async function revokeIntegration(
  db: Database,
  args: { id: string; ownerUserId: string },
): Promise<boolean> {
  const result = await db
    .update(integrations)
    .set({ revokedAt: new Date() })
    .where(and(eq(integrations.id, args.id), eq(integrations.ownerUserId, args.ownerUserId)))
    .returning();
  if (result.length > 0) cacheInvalidateById(args.id);
  return result.length > 0;
}
