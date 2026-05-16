import {
  type ClientHandle,
  addReaction,
  createComment,
  createDiscussion,
  getComment,
  getPage,
  listComments,
  listReactionsForComment,
  listReactionsForComments,
  removeReaction,
  requirePermission,
  resolveDiscussion,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import {
  BlocNotFoundError,
  BlocValidationError,
  RichTextArraySchema,
  encodeCursor,
} from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

interface SerializedComment {
  object: 'comment';
  id: string;
  parent: { type: 'page_id' | 'block_id'; page_id?: string; block_id?: string };
  discussion_id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { object: 'user'; id: string };
  rich_text: unknown;
  reactions: { emoji: string; count: number; user_ids: string[] }[];
}

function serializeComment(
  row: {
    id: string;
    discussionId: string;
    parentType: string;
    parentId: string;
    richText: unknown;
    createdBy: string;
    createdAt: Date;
    lastEditedAt: Date;
  },
  reactions: { emoji: string; userId: string }[] = [],
): SerializedComment {
  const parent: SerializedComment['parent'] =
    row.parentType === 'block'
      ? { type: 'block_id', block_id: row.parentId }
      : { type: 'page_id', page_id: row.parentId };
  const byEmoji = new Map<string, string[]>();
  for (const r of reactions) {
    const arr = byEmoji.get(r.emoji) ?? [];
    arr.push(r.userId);
    byEmoji.set(r.emoji, arr);
  }
  const reactionsArr = Array.from(byEmoji.entries()).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    user_ids: userIds,
  }));
  return {
    object: 'comment',
    id: row.id,
    parent,
    discussion_id: row.discussionId,
    created_time: row.createdAt.toISOString(),
    last_edited_time: row.lastEditedAt.toISOString(),
    created_by: { object: 'user', id: row.createdBy },
    rich_text: row.richText,
    reactions: reactionsArr,
  };
}

const CreateCommentSchema = z
  .object({
    parent: z
      .object({
        page_id: z.string().uuid().optional(),
        block_id: z.string().uuid().optional(),
      })
      .optional(),
    discussion_id: z.string().uuid().optional(),
    rich_text: RichTextArraySchema,
  })
  .strict()
  .refine(
    (b) =>
      b.discussion_id !== undefined ||
      b.parent?.page_id !== undefined ||
      b.parent?.block_id !== undefined,
    { message: 'Must provide either discussion_id, parent.page_id, or parent.block_id' },
  );

const ReactionSchema = z.object({ emoji: z.string().min(1).max(20) }).strict();

export function createCommentsRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  // POST /v1/comments
  router.post('/', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = CreateCommentSchema.parse(await c.req.json());
    return withSpan('comments', 'comments.create', {}, async () => {
      let parentType: 'page' | 'block';
      let parentId: string;
      let discussionId: string;
      if (body.discussion_id !== undefined) {
        discussionId = body.discussion_id;
        if (body.parent?.page_id !== undefined) {
          parentType = 'page';
          parentId = body.parent.page_id;
        } else if (body.parent?.block_id !== undefined) {
          parentType = 'block';
          parentId = body.parent.block_id;
        } else {
          throw new BlocValidationError(
            'Reply must include parent.page_id or parent.block_id',
            requestId,
          );
        }
      } else if (body.parent?.page_id !== undefined) {
        parentType = 'page';
        parentId = body.parent.page_id;
        const page = await getPage(deps.handle.db, parentId);
        if (page === null) throw new BlocNotFoundError(`Page ${parentId} not found`, requestId);
        await requirePermission(
          deps.handle.db,
          actor,
          { type: 'page', id: parentId },
          'can_comment',
        );
        const d = await createDiscussion(deps.handle.db, {
          parentType: 'page',
          parentId,
          createdBy: actor.userId,
        });
        discussionId = d.id;
      } else if (body.parent?.block_id !== undefined) {
        parentType = 'block';
        parentId = body.parent.block_id;
        const d = await createDiscussion(deps.handle.db, {
          parentType: 'block',
          parentId,
          createdBy: actor.userId,
        });
        discussionId = d.id;
      } else {
        throw new BlocValidationError('Missing parent or discussion_id', requestId);
      }

      const comment = await createComment(deps.handle.db, {
        discussionId,
        parentType,
        parentId,
        richText: body.rich_text,
        createdBy: actor.userId,
        lastEditedBy: actor.userId,
      });
      void emit({
        workspaceId: actor.workspaceId,
        type: 'comment.created',
        data: { comment_id: comment.id, parent_type: parentType, parent_id: parentId },
      });
      return c.json(serializeComment(comment));
    });
  });

  // GET /v1/comments?block_id=... or ?page_id=...
  router.get('/', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const url = new URL(c.req.url);
    const blockId = url.searchParams.get('block_id');
    const pageId = url.searchParams.get('page_id');
    if (blockId === null && pageId === null) {
      throw new BlocValidationError(
        'Either block_id or page_id query param is required',
        requestId,
      );
    }
    const parentType: 'block' | 'page' = blockId !== null ? 'block' : 'page';
    const parentId = (blockId ?? pageId) as string;
    return withSpan(
      'comments',
      'comments.list',
      { 'parent.type': parentType, 'parent.id': parentId },
      async () => {
        if (parentType === 'page') {
          await requirePermission(
            deps.handle.db,
            actor,
            { type: 'page', id: parentId },
            'can_read',
          );
        }
        const rows = await listComments(deps.handle.db, { parentType, parentId });
        const pageSize = Math.max(
          1,
          Math.min(100, Number(url.searchParams.get('page_size') ?? 100)),
        );
        const window = rows.slice(0, pageSize);
        const reactionRows = await listReactionsForComments(
          deps.handle.db,
          window.map((r) => r.id),
        );
        const byComment = new Map<string, { emoji: string; userId: string }[]>();
        for (const r of reactionRows) {
          const arr = byComment.get(r.commentId) ?? [];
          arr.push({ emoji: r.emoji, userId: r.userId });
          byComment.set(r.commentId, arr);
        }
        const serialized = window.map((row) => serializeComment(row, byComment.get(row.id) ?? []));
        return c.json({
          object: 'list',
          type: 'comment',
          results: serialized,
          next_cursor: rows.length > pageSize ? encodeCursor({ skip: pageSize }) : null,
          has_more: rows.length > pageSize,
          comment: {},
        });
      },
    );
  });

  // POST /v1/comments/:id/reactions
  router.post('/:id/reactions', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = ReactionSchema.parse(await c.req.json());
    const existing = await getComment(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Comment ${id} not found`, requestId);
    if (existing.parentType === 'page') {
      await requirePermission(
        deps.handle.db,
        actor,
        { type: 'page', id: existing.parentId },
        'can_comment',
      );
    }
    return withSpan(
      'comments',
      'comments.reactions.add',
      { 'comment.id': id, emoji: body.emoji },
      async () => {
        await addReaction(deps.handle.db, {
          commentId: id,
          userId: actor.userId,
          emoji: body.emoji,
        });
        const reactions = await listReactionsForComment(deps.handle.db, id);
        return c.json(
          serializeComment(
            existing,
            reactions.map((r) => ({ emoji: r.emoji, userId: r.userId })),
          ),
        );
      },
    );
  });

  // DELETE /v1/comments/:id/reactions/:emoji
  router.delete('/:id/reactions/:emoji', async (c) => {
    const id = c.req.param('id');
    const emoji = decodeURIComponent(c.req.param('emoji'));
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const existing = await getComment(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Comment ${id} not found`, requestId);
    if (existing.parentType === 'page') {
      await requirePermission(
        deps.handle.db,
        actor,
        { type: 'page', id: existing.parentId },
        'can_comment',
      );
    }
    return withSpan(
      'comments',
      'comments.reactions.remove',
      { 'comment.id': id, emoji },
      async () => {
        await removeReaction(deps.handle.db, {
          commentId: id,
          userId: actor.userId,
          emoji,
        });
        const reactions = await listReactionsForComment(deps.handle.db, id);
        return c.json(
          serializeComment(
            existing,
            reactions.map((r) => ({ emoji: r.emoji, userId: r.userId })),
          ),
        );
      },
    );
  });

  // POST /v1/comments/:id/resolve — resolve the comment's discussion.
  router.post('/:id/resolve', async (c) => {
    const id = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const existing = await getComment(deps.handle.db, id);
    if (existing === null) throw new BlocNotFoundError(`Comment ${id} not found`, requestId);
    if (existing.parentType === 'page') {
      await requirePermission(
        deps.handle.db,
        actor,
        { type: 'page', id: existing.parentId },
        'can_comment',
      );
    }
    return withSpan(
      'comments',
      'comments.resolve',
      { 'comment.id': id, 'discussion.id': existing.discussionId },
      async () => {
        await resolveDiscussion(deps.handle.db, existing.discussionId);
        void emit({
          workspaceId: actor.workspaceId,
          type: 'comment.resolved',
          data: { discussion_id: existing.discussionId, comment_id: id },
        });
        return c.json({ object: 'discussion', id: existing.discussionId, resolved: true });
      },
    );
  });

  return router;
}
