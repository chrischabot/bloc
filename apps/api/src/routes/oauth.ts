import { createHash, randomBytes } from 'node:crypto';
import {
  type ClientHandle,
  addMember,
  createUser,
  createWorkspace,
  recordEvent,
  schema,
} from '@bloc/db';
import { BlocAuthError, BlocValidationError } from '@bloc/shared';
import { sql } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

interface PendingState {
  state: string;
  codeVerifier: string;
  expiresAt: number;
}

/** In-memory store for pending OAuth states. Production swaps to Redis. */
const PENDING_STATES = new Map<string, PendingState>();

export function resetOAuthStates(): void {
  PENDING_STATES.clear();
}

function genState(): string {
  return randomBytes(24).toString('base64url');
}
function genVerifier(): string {
  return randomBytes(32).toString('base64url');
}
function challenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

const StartSchema = z.object({}).strict();

interface CallbackArgs {
  code: string;
  state: string;
  email?: string;
  name?: string;
}

const PostCallbackSchema = z
  .object({
    code: z.string().min(1).max(500),
    state: z.string().min(1).max(500),
    email: z.string().email().optional(),
    name: z.string().max(120).optional(),
  })
  .strict();

async function handleCallback(deps: Deps, c: Context, args: CallbackArgs): Promise<Response> {
  const requestId = c.get('requestId');
  const pending = PENDING_STATES.get(args.state);
  if (!pending) throw new BlocAuthError('Invalid or expired OAuth state', requestId);
  if (pending.expiresAt < Date.now()) {
    PENDING_STATES.delete(args.state);
    throw new BlocAuthError('OAuth state expired', requestId);
  }
  PENDING_STATES.delete(args.state);

  const testMode = process.env['AUTH_DELIVERY'] === 'test';
  if (!testMode) {
    throw new BlocValidationError('OAuth callback live exchange not yet wired (v1.1)', requestId);
  }
  if (args.email === undefined) {
    throw new BlocValidationError('Test-mode callback requires email', requestId);
  }

  // Find-or-create the user; auto-create a personal workspace on first sign-in.
  const [existing] = await deps.handle.db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = lower(${args.email})`)
    .limit(1);
  let userId: string;
  let workspaceId: string;
  if (existing === undefined) {
    const user = await createUser(deps.handle.db, {
      email: args.email,
      name: args.name ?? args.email.split('@')[0] ?? null,
      type: 'person',
    });
    const ws = await createWorkspace(deps.handle.db, {
      name: `${user.name ?? user.email}'s workspace`,
      plan: 'free',
    });
    await addMember(deps.handle.db, { workspaceId: ws.id, userId: user.id, role: 'owner' });
    await recordEvent(deps.handle.db, {
      workspaceId: ws.id,
      actorUserId: user.id,
      action: 'auth.google.signup',
    });
    userId = user.id;
    workspaceId = ws.id;
  } else {
    userId = existing.id;
    // Pick the first workspace the user belongs to.
    const [member] = await deps.handle.db
      .select()
      .from(schema.workspaceMembers)
      .where(sql`${schema.workspaceMembers.userId} = ${userId}`)
      .limit(1);
    if (member === undefined) {
      // Auto-create a workspace if the user has no memberships.
      const ws = await createWorkspace(deps.handle.db, {
        name: `${args.name ?? args.email}'s workspace`,
        plan: 'free',
      });
      await addMember(deps.handle.db, { workspaceId: ws.id, userId, role: 'owner' });
      workspaceId = ws.id;
    } else {
      workspaceId = member.workspaceId;
    }
    await recordEvent(deps.handle.db, {
      workspaceId,
      actorUserId: userId,
      action: 'auth.google.login',
    });
  }

  return c.json({
    object: 'auth_session',
    provider: 'google',
    user_id: userId,
    workspace_id: workspaceId,
    session_bearer: `Bearer test_${workspaceId}_${userId}`,
  });
}

export function createOAuthRouter(deps: Deps): Hono {
  const router = new Hono();

  // POST /v1/auth/google/start
  router.post('/google/start', async (c) => {
    StartSchema.parse(await c.req.json().catch(() => ({})));
    const state = genState();
    const codeVerifier = genVerifier();
    PENDING_STATES.set(state, {
      state,
      codeVerifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const clientId = process.env['GOOGLE_CLIENT_ID'] ?? 'stub_client_id';
    const redirectUri =
      process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:3000/auth/google/callback';
    const codeChallenge = challenge(codeVerifier);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return c.json({
      object: 'oauth_start',
      provider: 'google',
      authorization_url: url.toString(),
      state,
    });
  });

  // GET /v1/auth/google/callback — browser redirect flow. Reads code+state
  // (and test-mode email/name) from query string. Same validation as POST.
  router.get('/google/callback', async (c) => {
    const url = new URL(c.req.url);
    const raw = {
      code: url.searchParams.get('code') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
      email: url.searchParams.get('email') ?? undefined,
      name: url.searchParams.get('name') ?? undefined,
    };
    const parsed = PostCallbackSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BlocValidationError(
        'OAuth callback requires valid code + state',
        c.get('requestId'),
      );
    }
    const argsObj: CallbackArgs = { code: parsed.data.code, state: parsed.data.state };
    if (parsed.data.email !== undefined) argsObj.email = parsed.data.email;
    if (parsed.data.name !== undefined) argsObj.name = parsed.data.name;
    return handleCallback(deps, c, argsObj);
  });

  // POST /v1/auth/google/callback — SDK / JSON flow.
  router.post('/google/callback', async (c) => {
    const body = PostCallbackSchema.parse(await c.req.json());
    const argsObj: CallbackArgs = { code: body.code, state: body.state };
    if (body.email !== undefined) argsObj.email = body.email;
    if (body.name !== undefined) argsObj.name = body.name;
    return handleCallback(deps, c, argsObj);
  });

  return router;
}
