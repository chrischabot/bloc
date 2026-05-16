import {
  type ClientHandle,
  addMember,
  createUser,
  createWorkspace,
  findUserByEmail,
  schema,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { makeTestBearer } from '../middleware/auth.ts';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

const DEV_EMAIL = 'dev@bloc.local';
const DEV_WORKSPACE_NAME = 'Dev Workspace';

export function createBootstrapRouter(deps: Deps): Hono {
  const router = new Hono();

  router.post('/', async (c) => {
    if (process.env['BOOTSTRAP_DEV'] !== '1') {
      return c.json(
        {
          object: 'error',
          status: 403,
          code: 'restricted_resource',
          message: 'Bootstrap is disabled. Set BOOTSTRAP_DEV=1 to enable.',
          request_id: c.get('requestId'),
        },
        403,
      );
    }
    return withSpan('bootstrap', 'bootstrap.dev', {}, async () => {
      let user = await findUserByEmail(deps.handle.db, DEV_EMAIL);
      if (user === null) {
        user = await createUser(deps.handle.db, {
          email: DEV_EMAIL,
          name: 'Dev User',
          type: 'person',
        });
      }
      // Find an existing workspace owned by this user or create one.
      const [membership] = await deps.handle.db
        .select({
          workspaceId: schema.workspaceMembers.workspaceId,
          role: schema.workspaceMembers.role,
        })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.userId, user.id))
        .limit(1);
      let workspaceId: string;
      if (membership !== undefined) {
        workspaceId = membership.workspaceId;
      } else {
        const ws = await createWorkspace(deps.handle.db, {
          name: DEV_WORKSPACE_NAME,
          plan: 'free',
        });
        await addMember(deps.handle.db, {
          workspaceId: ws.id,
          userId: user.id,
          role: 'owner',
        });
        workspaceId = ws.id;
      }
      return c.json({
        object: 'bootstrap',
        user_id: user.id,
        workspace_id: workspaceId,
        user: { object: 'user', id: user.id, type: user.type, name: user.name, email: user.email },
        session_bearer: makeTestBearer(workspaceId, user.id),
      });
    });
  });

  return router;
}
