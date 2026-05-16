import {
  type ClientHandle,
  between,
  createPage,
  getDatabase,
  getDefaultDataSource,
  listPagesByDataSource,
  listProperties,
  requirePermission,
  schema,
  setPageProperty,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import '../types.ts';
import {
  FormConfigSchema,
  BlocNotFoundError,
  BlocValidationError,
  PROPERTY_VALUE_PAYLOADS,
  type PropertyType,
  SubmissionBodySchema,
  encodeCursor,
  isPropertyType,
  isReadonlyPropertyType,
} from '@bloc/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const CreateViewSchema = z
  .object({
    database_id: z.string().uuid(),
    name: z.string().min(1).max(100),
    config: FormConfigSchema,
  })
  .strict();

interface FormViewMeta {
  id: string;
  databaseId: string;
  name: string;
  config: unknown;
}

async function getFormView(deps: Deps, id: string): Promise<FormViewMeta | null> {
  const [row] = await deps.handle.db
    .select()
    .from(schema.databaseViews)
    .where(eq(schema.databaseViews.id, id))
    .limit(1);
  if (!row || row.type !== 'form') return null;
  return { id: row.id, databaseId: row.databaseId, name: row.name, config: row.config };
}

export function createFormsRouter(deps: Deps): Hono {
  const router = new Hono();

  // POST /v1/forms — create a form view on a database
  router.post('/', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CreateViewSchema.parse(await c.req.json());
    const db = await getDatabase(deps.handle.db, body.database_id);
    if (db === null) {
      throw new BlocNotFoundError(`Database ${body.database_id} not found`, requestId);
    }
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: body.database_id },
      'can_edit',
    );

    return withSpan('forms', 'forms.create', { 'database.id': body.database_id }, async () => {
      // Determine position after the last existing view.
      const sibling = await deps.handle.db
        .select({ position: schema.databaseViews.position })
        .from(schema.databaseViews)
        .where(eq(schema.databaseViews.databaseId, body.database_id))
        .orderBy(asc(schema.databaseViews.position));
      const lastSibling = sibling.at(-1);
      const lastPos = lastSibling !== undefined ? lastSibling.position : null;
      const position = between(lastPos, null);
      const [view] = await deps.handle.db
        .insert(schema.databaseViews)
        .values({
          databaseId: body.database_id,
          name: body.name,
          type: 'form',
          config: body.config as Record<string, unknown>,
          position,
        })
        .returning();
      if (!view) throw new Error('createFormView: empty insert');
      return c.json({
        object: 'form_view',
        id: view.id,
        database_id: view.databaseId,
        name: view.name,
        config: view.config,
        created_time: view.createdAt.toISOString(),
        last_edited_time: view.updatedAt.toISOString(),
      });
    });
  });

  // GET /v1/forms/:viewId — retrieve a form (private, requires read on the DB)
  router.get('/:viewId', async (c) => {
    const id = c.req.param('viewId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const view = await getFormView(deps, id);
    if (view === null) throw new BlocNotFoundError(`Form ${id} not found`, requestId);
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: view.databaseId },
      'can_read',
    );
    return c.json({
      object: 'form_view',
      id: view.id,
      database_id: view.databaseId,
      name: view.name,
      config: view.config,
    });
  });

  return router;
}

/**
 * Public submission router. Mounted **outside** the auth middleware to allow
 * anonymous submissions when `policy=public`. The route checks the form's
 * policy and applies appropriate auth gating.
 */
export function createPublicFormsRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  router.post('/:viewId/submissions', async (c) => {
    const id = c.req.param('viewId');
    const requestId = c.get('requestId');
    const view = await getFormView(deps, id);
    if (view === null) throw new BlocNotFoundError(`Form ${id} not found`, requestId);
    const cfg = view.config as {
      policy?: string;
      close_at?: string | null;
      max_submissions?: number | null;
    };
    if (cfg.close_at !== null && cfg.close_at !== undefined) {
      const closeMs = new Date(cfg.close_at).getTime();
      if (Number.isFinite(closeMs) && Date.now() >= closeMs) {
        return c.json(
          {
            object: 'error',
            status: 410,
            code: 'gone',
            message: 'Form closed',
            request_id: requestId,
          },
          410,
        );
      }
    }
    if (cfg.max_submissions !== null && cfg.max_submissions !== undefined) {
      const def = await getDefaultDataSource(deps.handle.db, view.databaseId);
      const dsId = def?.id;
      if (dsId !== undefined) {
        const submissions = await listPagesByDataSource(deps.handle.db, dsId);
        if (submissions.length >= cfg.max_submissions) {
          return c.json(
            {
              object: 'error',
              status: 410,
              code: 'gone',
              message: 'Form submission cap reached',
              request_id: requestId,
            },
            410,
          );
        }
      }
    }

    const body = SubmissionBodySchema.parse(await c.req.json());

    // Public forms accept anonymous submissions. Workspace / people forms still
    // require a bearer / membership (enforced via the actor on the protected
    // mount). The public mount uses a synthetic submitter user id.
    const submitterUserId = c.get('actor')?.userId ?? null;
    if (cfg.policy !== 'public' && submitterUserId === null) {
      return c.json(
        {
          object: 'error',
          status: 401,
          code: 'unauthorized',
          message: 'Form requires authentication',
          request_id: requestId,
        },
        401,
      );
    }

    // Load the target database + properties.
    const db = await getDatabase(deps.handle.db, view.databaseId);
    if (db === null) {
      throw new BlocNotFoundError(`Database ${view.databaseId} not found`, requestId);
    }
    const props = await listProperties(deps.handle.db, view.databaseId);
    const byName = new Map(props.map((p) => [p.name, p]));
    const byId = new Map(props.map((p) => [p.id, p]));

    // Required-title rule.
    const titleProp = props.find((p) => p.type === 'title');
    if (titleProp !== undefined) {
      const hasTitle = Object.entries(body.values).some(
        ([k]) => k === titleProp.name || k === titleProp.id,
      );
      if (!hasTitle) {
        throw new BlocValidationError(
          `Required title property '${titleProp.name}' missing`,
          requestId,
        );
      }
    }

    // Create the row.
    const def = await getDefaultDataSource(deps.handle.db, view.databaseId);
    const sysUserId = submitterUserId ?? db.createdBy;
    const createArgs: Parameters<typeof createPage>[1] = {
      workspaceId: db.workspaceId,
      parentType: 'database',
      parentId: view.databaseId,
      createdBy: sysUserId,
      lastEditedBy: sysUserId,
    };
    if (def !== null) createArgs.dataSourceId = def.id;
    const page = await createPage(deps.handle.db, createArgs);

    // Apply each value.
    for (const [key, raw] of Object.entries(body.values)) {
      const propDef = byName.get(key) ?? byId.get(key);
      if (propDef === undefined) {
        throw new BlocValidationError(`Unknown property '${key}' on database`, requestId);
      }
      if (!isPropertyType(propDef.type)) continue;
      if (isReadonlyPropertyType(propDef.type as PropertyType)) {
        throw new BlocValidationError(
          `Cannot set read-only property '${key}' (${propDef.type})`,
          requestId,
        );
      }
      const valueSchema = PROPERTY_VALUE_PAYLOADS[propDef.type as PropertyType];
      const parsed = valueSchema.safeParse(raw);
      if (!parsed.success) {
        throw new BlocValidationError(
          `Invalid value for property '${key}'`,
          requestId,
          parsed.error.issues.map((iss) => ({
            path: `values.${key}.${iss.path.join('.')}`,
            issue: iss.message,
          })),
        );
      }
      await setPageProperty(deps.handle.db, {
        pageId: page.id,
        propertyId: propDef.id,
        value: { type: propDef.type, ...(parsed.data as Record<string, unknown>) },
      });
    }

    await emit({
      workspaceId: db.workspaceId,
      type: 'form.submission.created',
      data: {
        form_id: view.id,
        database_id: view.databaseId,
        page_id: page.id,
        submitter_user_id: submitterUserId,
      },
    });

    return c.json({
      object: 'form_submission',
      id: page.id,
      row_id: page.id,
      redirect_url:
        typeof (view.config as { confirmation?: { redirect_url?: string | null } }).confirmation
          ?.redirect_url === 'string'
          ? (view.config as { confirmation: { redirect_url: string } }).confirmation.redirect_url
          : null,
    });
  });

  return router;
}

/** Submissions list endpoint — workspace-scoped. */
export function createFormSubmissionsRouter(deps: Deps): Hono {
  const router = new Hono();

  router.get('/:viewId/submissions', async (c) => {
    const id = c.req.param('viewId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const view = await getFormView(deps, id);
    if (view === null) throw new BlocNotFoundError(`Form ${id} not found`, requestId);
    await requirePermission(
      deps.handle.db,
      actor,
      { type: 'database', id: view.databaseId },
      'can_read',
    );
    const rows = await deps.handle.db
      .select()
      .from(schema.pages)
      .where(
        and(
          eq(schema.pages.parentId, view.databaseId),
          eq(schema.pages.parentType, 'database'),
          eq(schema.pages.archived, false),
        ),
      )
      .orderBy(desc(schema.pages.createdAt))
      .limit(100);
    return c.json({
      object: 'list',
      type: 'form_submission',
      results: rows.map((r) => ({
        object: 'form_submission',
        id: r.id,
        row_id: r.id,
        submitter_user_id: r.createdBy,
        created_at: r.createdAt.toISOString(),
      })),
      next_cursor: rows.length === 100 ? encodeCursor({ skip: 100 }) : null,
      has_more: rows.length === 100,
      form_submission: {},
    });
  });

  return router;
}
