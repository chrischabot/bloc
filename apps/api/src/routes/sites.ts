import {
  type ClientHandle,
  type Publication,
  createCustomDomain,
  deleteCustomDomain,
  generateSlug,
  getCustomDomain,
  getMemberRole,
  getPage,
  getPublicationByPage,
  getPublicationBySlug,
  listCustomDomains,
  recordEvent,
  requirePermission,
  unpublish,
  updateCustomDomainStatus,
  upsertPublication,
} from '@bloc/db';
import { BlocConflictError, BlocNotFoundError, BlocValidationError } from '@bloc/shared';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const UpsertSchema = z
  .object({
    allow_edit: z.boolean().optional(),
    allow_comment: z.boolean().optional(),
    allow_duplicate: z.boolean().optional(),
    index_in_search: z.boolean().optional(),
    show_toc: z.boolean().optional(),
    show_navbar: z.boolean().optional(),
    expires_at: z.string().datetime().nullable().optional(),
    custom_domain_id: z.string().uuid().nullable().optional(),
  })
  .strict();

const DomainSchema = z
  .object({
    domain: z
      .string()
      .min(3)
      .max(253)
      .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i),
    page_id: z.string().uuid().optional(),
  })
  .strict();

interface SerializedPublication {
  object: 'publication';
  page_id: string;
  state: string;
  url: string;
  slug: string;
  custom_domain: string | null;
  allow_edit: boolean;
  allow_comment: boolean;
  allow_duplicate: boolean;
  index_in_search: boolean;
  show_toc: boolean;
  show_navbar: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

async function serialize(deps: Deps, row: Publication): Promise<SerializedPublication> {
  let url = `/${row.slug}`;
  let customDomainName: string | null = null;
  if (row.customDomainId !== null) {
    const cd = await getCustomDomain(deps.handle.db, row.customDomainId);
    if (cd !== null) {
      customDomainName = cd.domain;
      url = `https://${cd.domain}/${row.slug}`;
    }
  }
  return {
    object: 'publication',
    page_id: row.pageId,
    state: row.state,
    url,
    slug: row.slug,
    custom_domain: customDomainName,
    allow_edit: row.allowEdit,
    allow_comment: row.allowComment,
    allow_duplicate: row.allowDuplicate,
    index_in_search: row.indexInSearch,
    show_toc: row.showToc,
    show_navbar: row.showNavbar,
    expires_at: row.expiresAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function createPublicationsRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  // GET /v1/pages/:id/publication
  router.get('/:id/publication', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'can_read');
    const row = await getPublicationByPage(deps.handle.db, id);
    if (row === null) throw new BlocNotFoundError(`No publication for page ${id}`, requestId);
    return c.json(await serialize(deps, row));
  });

  // POST /v1/pages/:id/publication
  router.post('/:id/publication', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const page = await getPage(deps.handle.db, id);
    if (page === null) throw new BlocNotFoundError(`Page ${id} not found`, requestId);
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'full_access');
    const body = UpsertSchema.parse(await c.req.json().catch(() => ({})));

    // Title (best-effort) for slug derivation.
    const title =
      typeof (page.icon as { emoji?: string } | null)?.emoji === 'string' ? 'page' : 'page';
    const slug = generateSlug(title);
    const upsertArgs: Parameters<typeof upsertPublication>[1] = {
      pageId: id,
      slug,
      createdBy: actor.userId,
    };
    if (body.allow_edit !== undefined) upsertArgs.allowEdit = body.allow_edit;
    if (body.allow_comment !== undefined) upsertArgs.allowComment = body.allow_comment;
    if (body.allow_duplicate !== undefined) upsertArgs.allowDuplicate = body.allow_duplicate;
    if (body.index_in_search !== undefined) upsertArgs.indexInSearch = body.index_in_search;
    if (body.show_toc !== undefined) upsertArgs.showToc = body.show_toc;
    if (body.show_navbar !== undefined) upsertArgs.showNavbar = body.show_navbar;
    if (body.expires_at !== undefined) {
      upsertArgs.expiresAt = body.expires_at === null ? null : new Date(body.expires_at);
    }
    if (body.custom_domain_id !== undefined) {
      upsertArgs.customDomainId = body.custom_domain_id;
    }
    const row = await upsertPublication(deps.handle.db, upsertArgs);
    await emit({
      workspaceId: actor.workspaceId,
      type: 'publication.created',
      data: { page_id: id },
    });
    await recordEvent(deps.handle.db, {
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      action: 'publication.created',
      resourceType: 'page',
      resourceId: id,
    });
    return c.json(await serialize(deps, row));
  });

  // DELETE /v1/pages/:id/publication
  router.delete('/:id/publication', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    await requirePermission(deps.handle.db, actor, { type: 'page', id }, 'full_access');
    const ok = await unpublish(deps.handle.db, id);
    if (!ok) throw new BlocNotFoundError(`No publication for page ${id}`, requestId);
    await emit({
      workspaceId: actor.workspaceId,
      type: 'publication.deleted',
      data: { page_id: id },
    });
    await recordEvent(deps.handle.db, {
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      action: 'publication.deleted',
      resourceType: 'page',
      resourceId: id,
    });
    return c.body(null, 204);
  });

  return router;
}

export function createCustomDomainsRouter(deps: Deps): Hono {
  const router = new Hono();

  async function requireOwner(c: Context): Promise<void> {
    const actor = c.get('actor');
    const requestId = c.get('requestId');
    const role = await getMemberRole(deps.handle.db, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
    });
    if (role !== 'owner') {
      throw new BlocValidationError(
        `Workspace owner role required (actor has '${role ?? 'none'}')`,
        requestId,
      );
    }
  }

  // GET /v1/workspaces/:id/custom_domains
  router.get('/:id/custom_domains', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    const rows = await listCustomDomains(deps.handle.db, id);
    return c.json({
      object: 'list',
      type: 'custom_domain',
      results: rows.map((r) => ({
        object: 'custom_domain',
        id: r.id,
        domain: r.domain,
        status: r.status,
        dns_records: r.dnsRecords,
        created_at: r.createdAt.toISOString(),
      })),
      next_cursor: null,
      has_more: false,
    });
  });

  // POST /v1/workspaces/:id/custom_domains
  router.post('/:id/custom_domains', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    await requireOwner(c);
    const body = DomainSchema.parse(await c.req.json());
    // Reject reserved/internal hostnames.
    if (/(^|\.)(localhost|notion\.so|notion\.com)$/i.test(body.domain)) {
      throw new BlocValidationError('Reserved domain', requestId);
    }
    try {
      const row = await createCustomDomain(deps.handle.db, {
        workspaceId: id,
        domain: body.domain,
      });
      await recordEvent(deps.handle.db, {
        workspaceId: id,
        actorUserId: actor.userId,
        action: 'custom_domain.created',
        resourceType: 'workspace',
        resourceId: id,
      });
      return c.json({
        object: 'custom_domain',
        id: row.id,
        domain: row.domain,
        status: row.status,
        dns_records: row.dnsRecords,
        created_at: row.createdAt.toISOString(),
      });
    } catch (err) {
      const message = (err as Error).message ?? '';
      if (/unique|duplicate|already exists/i.test(message)) {
        throw new BlocConflictError(`Domain ${body.domain} already registered`, requestId);
      }
      throw err;
    }
  });

  // PATCH /v1/workspaces/:id/custom_domains/:domainId — used by the verification simulator
  router.patch('/:id/custom_domains/:domainId', async (c) => {
    const id = c.req.param('id');
    const domainId = c.req.param('domainId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    await requireOwner(c);
    const body = z
      .object({
        status: z.enum(['pending', 'provisioning', 'live', 'failed']).optional(),
      })
      .strict()
      .parse(await c.req.json());
    if (body.status === undefined) {
      throw new BlocValidationError('status field required', requestId);
    }
    const row = await updateCustomDomainStatus(deps.handle.db, {
      id: domainId,
      workspaceId: id,
      status: body.status,
    });
    if (row === null) {
      throw new BlocNotFoundError(`Custom domain ${domainId} not found`, requestId);
    }
    return c.json({
      object: 'custom_domain',
      id: row.id,
      domain: row.domain,
      status: row.status,
    });
  });

  // DELETE /v1/workspaces/:id/custom_domains/:domainId
  router.delete('/:id/custom_domains/:domainId', async (c) => {
    const id = c.req.param('id');
    const domainId = c.req.param('domainId');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    if (id !== actor.workspaceId) {
      throw new BlocValidationError('workspace id mismatch', requestId);
    }
    await requireOwner(c);
    const ok = await deleteCustomDomain(deps.handle.db, { id: domainId, workspaceId: id });
    if (!ok) throw new BlocNotFoundError(`Custom domain ${domainId} not found`, requestId);
    return c.body(null, 204);
  });

  return router;
}

/** Public (no-auth) lookup of a publication by slug — backs the public renderer. */
export function createPublicSitesRouter(deps: Deps): Hono {
  const router = new Hono();

  router.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const requestId = c.get('requestId');
    const pub = await getPublicationBySlug(deps.handle.db, slug);
    if (pub === null || pub.state !== 'live') {
      throw new BlocNotFoundError(`No published page at /${slug}`, requestId);
    }
    if (pub.expiresAt !== null && pub.expiresAt.getTime() < Date.now()) {
      throw new BlocNotFoundError('Publication expired', requestId);
    }
    return c.json({
      object: 'publication',
      slug: pub.slug,
      page_id: pub.pageId,
      allow_comment: pub.allowComment,
      allow_duplicate: pub.allowDuplicate,
      show_toc: pub.showToc,
      show_navbar: pub.showNavbar,
    });
  });

  return router;
}
