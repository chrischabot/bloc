import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../client.ts';
import { commentReactions, comments, discussions } from '../schema/comments.ts';

export type Discussion = typeof discussions.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type CommentReaction = typeof commentReactions.$inferSelect;

export async function createDiscussion(
  db: Database,
  input: typeof discussions.$inferInsert,
): Promise<Discussion> {
  const [row] = await db.insert(discussions).values(input).returning();
  if (!row) throw new Error('createDiscussion: empty insert');
  return row;
}

export async function createComment(
  db: Database,
  input: typeof comments.$inferInsert,
): Promise<Comment> {
  const [row] = await db.insert(comments).values(input).returning();
  if (!row) throw new Error('createComment: empty insert');
  return row;
}

export async function getComment(db: Database, id: string): Promise<Comment | null> {
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return row ?? null;
}

export async function listComments(
  db: Database,
  args: { parentType: 'page' | 'block'; parentId: string },
): Promise<Comment[]> {
  return db
    .select()
    .from(comments)
    .where(and(eq(comments.parentType, args.parentType), eq(comments.parentId, args.parentId)))
    .orderBy(asc(comments.createdAt));
}

export async function resolveDiscussion(db: Database, id: string): Promise<void> {
  await db
    .update(discussions)
    .set({ resolved: true, updatedAt: new Date() })
    .where(eq(discussions.id, id));
}

/** Add a reaction to a comment. Idempotent on (comment_id, user_id, emoji). */
export async function addReaction(
  db: Database,
  args: { commentId: string; userId: string; emoji: string },
): Promise<CommentReaction> {
  try {
    const [row] = await db.insert(commentReactions).values(args).returning();
    if (!row) throw new Error('addReaction: empty insert');
    return row;
  } catch (err) {
    // Duplicate-key: return the existing reaction.
    const [existing] = await db
      .select()
      .from(commentReactions)
      .where(
        and(
          eq(commentReactions.commentId, args.commentId),
          eq(commentReactions.userId, args.userId),
          eq(commentReactions.emoji, args.emoji),
        ),
      )
      .limit(1);
    if (existing) return existing;
    throw err;
  }
}

export async function removeReaction(
  db: Database,
  args: { commentId: string; userId: string; emoji: string },
): Promise<boolean> {
  const result = await db
    .delete(commentReactions)
    .where(
      and(
        eq(commentReactions.commentId, args.commentId),
        eq(commentReactions.userId, args.userId),
        eq(commentReactions.emoji, args.emoji),
      ),
    )
    .returning();
  return result.length > 0;
}

export async function listReactionsForComment(
  db: Database,
  commentId: string,
): Promise<CommentReaction[]> {
  return db
    .select()
    .from(commentReactions)
    .where(eq(commentReactions.commentId, commentId))
    .orderBy(asc(commentReactions.createdAt));
}

export async function listReactionsForComments(
  db: Database,
  commentIds: string[],
): Promise<CommentReaction[]> {
  if (commentIds.length === 0) return [];
  return db
    .select()
    .from(commentReactions)
    .where(inArray(commentReactions.commentId, commentIds))
    .orderBy(asc(commentReactions.createdAt));
}
