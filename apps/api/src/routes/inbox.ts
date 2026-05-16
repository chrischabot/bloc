import { type ClientHandle, schema } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocValidationError, encodeCursor } from '@bloc/shared';
import { and, desc, eq, gte, ilike, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

interface InboxEntry {
  object: 'inbox_entry';
  /** Synthetic id: `${kind}:${resourceId}:${ts}` so the inbox can dedupe. */
  id: string;
  kind: 'mention' | 'comment' | 'page_update';
  actor_user_id: string | null;
  target_page_id: string;
  /** Optional preview text. */
  snippet: string | null;
  created_at: string;
}

const InboxQuerySchema = z.object({
  page_size: z.coerce.number().int().min(1).max(100).default(50),
  since: z.string().datetime().optional(),
  kind: z.enum(['mention', 'comment', 'page_update', 'all']).default('all'),
});

export function createInboxRouter(deps: Deps): Hono {
  const router = new Hono();

  router.get('/', async (c) => {
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const parsed = InboxQuerySchema.parse(Object.fromEntries(url.searchParams));
    return withSpan(
      'inbox',
      'inbox.list',
      { 'user.id': actor.userId, kind: parsed.kind, 'page.size': parsed.page_size },
      async () => {
        const since = parsed.since !== undefined ? new Date(parsed.since) : undefined;
        if (since !== undefined && Number.isNaN(since.getTime())) {
          throw new BlocValidationError('Invalid since timestamp', c.get('requestId'));
        }
        const out: InboxEntry[] = [];

        // 1) Comments on pages I created (any comment.created audit event whose
        //    resource_id is a page I own).
        const myPages = await deps.handle.db
          .select({ id: schema.pages.id })
          .from(schema.pages)
          .where(
            and(
              eq(schema.pages.workspaceId, actor.workspaceId),
              eq(schema.pages.createdBy, actor.userId),
              eq(schema.pages.archived, false),
            ),
          )
          .limit(200);
        const myPageIds = new Set(myPages.map((p) => p.id));

        if (parsed.kind === 'all' || parsed.kind === 'comment' || parsed.kind === 'mention') {
          const commentRows = await deps.handle.db
            .select()
            .from(schema.comments)
            .innerJoin(schema.discussions, eq(schema.comments.discussionId, schema.discussions.id))
            .where(
              and(
                eq(schema.comments.parentType, 'page'),
                ne(schema.comments.createdBy, actor.userId),
                since !== undefined ? gte(schema.comments.createdAt, since) : undefined,
              ),
            )
            .orderBy(desc(schema.comments.createdAt))
            .limit(parsed.page_size * 3);

          for (const row of commentRows) {
            const c = row.comments;
            const isOwner = myPageIds.has(c.parentId);
            const richText = c.richText as Array<{
              type?: string;
              plain_text?: string;
              mention?: { type?: string; user?: { id?: string } };
            }>;
            const mentionsMe = Array.isArray(richText)
              ? richText.some(
                  (n) =>
                    n.type === 'mention' &&
                    n.mention?.type === 'user' &&
                    n.mention.user?.id === actor.userId,
                )
              : false;
            if (!isOwner && !mentionsMe) continue;
            const snippet = Array.isArray(richText)
              ? richText
                  .map((n) => n.plain_text ?? '')
                  .join('')
                  .slice(0, 200)
              : null;
            out.push({
              object: 'inbox_entry',
              id: `${mentionsMe ? 'mention' : 'comment'}:${c.id}:${c.createdAt.getTime()}`,
              kind: mentionsMe ? 'mention' : 'comment',
              actor_user_id: c.createdBy,
              target_page_id: c.parentId,
              snippet,
              created_at: c.createdAt.toISOString(),
            });
          }
        }

        // 2) Page updates: pages I own that someone else edited.
        if (parsed.kind === 'all' || parsed.kind === 'page_update') {
          const updateRows = await deps.handle.db
            .select()
            .from(schema.pages)
            .where(
              and(
                eq(schema.pages.workspaceId, actor.workspaceId),
                eq(schema.pages.createdBy, actor.userId),
                eq(schema.pages.archived, false),
                ne(schema.pages.lastEditedBy, actor.userId),
                since !== undefined ? gte(schema.pages.lastEditedAt, since) : undefined,
              ),
            )
            .orderBy(desc(schema.pages.lastEditedAt))
            .limit(parsed.page_size);
          for (const row of updateRows) {
            out.push({
              object: 'inbox_entry',
              id: `page_update:${row.id}:${row.lastEditedAt.getTime()}`,
              kind: 'page_update',
              actor_user_id: row.lastEditedBy,
              target_page_id: row.id,
              snippet: null,
              created_at: row.lastEditedAt.toISOString(),
            });
          }
        }

        // 3) Mentions surfaced via rich_text inside other pages' blocks (best-effort).
        //    Substring match on the user-id in the JSON content. The backlinks
        //    indexer eventually populates a structured `backlinks` table, but
        //    @user mentions aren't currently captured there (only @page).
        //    Cheap fallback: ilike against the workspace blocks.
        if (parsed.kind === 'all' || parsed.kind === 'mention') {
          const hits = await deps.handle.db
            .select()
            .from(schema.blocks)
            .where(
              and(
                eq(schema.blocks.workspaceId, actor.workspaceId),
                ilike(sql`${schema.blocks.content}::text`, `%${actor.userId}%`),
                ne(schema.blocks.lastEditedBy, actor.userId),
                since !== undefined ? gte(schema.blocks.lastEditedAt, since) : undefined,
              ),
            )
            .orderBy(desc(schema.blocks.lastEditedAt))
            .limit(parsed.page_size);
          for (const row of hits) {
            // Only count if the content actually contains a `mention` for this user id.
            const content = row.content as Record<string, unknown>;
            if (!JSON.stringify(content).includes(actor.userId)) continue;
            const pageId = row.parentType === 'page' ? row.parentId : row.workspaceId;
            out.push({
              object: 'inbox_entry',
              id: `mention:${row.id}:${row.lastEditedAt.getTime()}`,
              kind: 'mention',
              actor_user_id: row.lastEditedBy,
              target_page_id: pageId,
              snippet: null,
              created_at: row.lastEditedAt.toISOString(),
            });
          }
        }

        // Sort newest first, dedupe by synthetic id, paginate.
        const seen = new Set<string>();
        const sorted = out
          .filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          })
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        const window = sorted.slice(0, parsed.page_size);

        return c.json({
          object: 'list',
          type: 'inbox_entry',
          results: window,
          next_cursor:
            sorted.length > parsed.page_size ? encodeCursor({ skip: parsed.page_size }) : null,
          has_more: sorted.length > parsed.page_size,
          inbox_entry: {},
        });
      },
    );
  });

  return router;
}
