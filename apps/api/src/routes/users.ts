import { type ClientHandle, getUser, listUsers } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  BlocNotFoundError,
  BlocValidationError,
  decodeCursor,
  encodeCursor,
} from '@bloc/shared';
import { Hono } from 'hono';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

interface SerializedUser {
  object: 'user';
  id: string;
  type: 'person' | 'bot';
  name: string | null;
  avatar_url: string | null;
  person?: { email: string };
  bot?: { owner: { type: 'workspace'; workspace: true }; workspace_name: string | null };
}

function serializeUser(row: {
  id: string;
  type: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}): SerializedUser {
  const base: SerializedUser = {
    object: 'user',
    id: row.id,
    type: row.type === 'bot' ? 'bot' : 'person',
    name: row.name,
    avatar_url: row.avatarUrl,
  };
  if (base.type === 'person') {
    base.person = { email: row.email };
  } else {
    base.bot = {
      owner: { type: 'workspace', workspace: true },
      workspace_name: null,
    };
  }
  return base;
}

export function createUsersRouter(deps: Deps): Hono {
  const router = new Hono();

  // GET /v1/users/me
  router.get('/me', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    return withSpan('users', 'users.me', { 'user.id': actor.userId }, async () => {
      const user = await getUser(deps.handle.db, actor.userId);
      if (user === null) throw new BlocNotFoundError(`User ${actor.userId} not found`, requestId);
      return c.json(serializeUser(user));
    });
  });

  // GET /v1/users
  router.get('/', async (c) => {
    const url = new URL(c.req.url);
    const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get('page_size') ?? 100)));
    const startCursor = url.searchParams.get('start_cursor') ?? undefined;
    let skip = 0;
    if (startCursor !== undefined) {
      try {
        const decoded = decodeCursor<{ skip: number }>(startCursor);
        skip = decoded.skip;
      } catch {
        skip = 0;
      }
    }
    return withSpan('users', 'users.list', { 'page.size': pageSize }, async () => {
      const all = await listUsers(deps.handle.db, 10_000);
      const window = all.slice(skip, skip + pageSize);
      const hasMore = all.length > skip + pageSize;
      return c.json({
        object: 'list',
        type: 'user',
        results: window.map(serializeUser),
        next_cursor: hasMore ? encodeCursor({ skip: skip + pageSize }) : null,
        has_more: hasMore,
        user: {},
      });
    });
  });

  // GET /v1/users/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      throw new BlocValidationError(`Malformed user id '${id}'`, requestId);
    }
    return withSpan('users', 'users.retrieve', { 'user.id': id }, async () => {
      const user = await getUser(deps.handle.db, id);
      if (user === null) throw new BlocNotFoundError(`User ${id} not found`, requestId);
      return c.json(serializeUser(user));
    });
  });

  return router;
}
