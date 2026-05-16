import type { BlocClient } from './client.ts';

export interface CommentReactionGroup {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface CommentObject {
  object: 'comment';
  id: string;
  parent: Record<string, unknown>;
  discussion_id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { object: 'user'; id: string };
  rich_text: unknown;
  reactions?: CommentReactionGroup[];
}

export interface CommentListResponse {
  object: 'list';
  type: 'comment';
  results: CommentObject[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface DiscussionResolved {
  object: 'discussion';
  id: string;
  resolved: boolean;
}

export class CommentsNamespace {
  constructor(private readonly client: BlocClient) {}

  create(args: {
    parent?: { page_id?: string; block_id?: string };
    discussion_id?: string;
    rich_text: Array<Record<string, unknown>>;
  }): Promise<CommentObject> {
    return this.client.request<CommentObject>({
      method: 'POST',
      path: '/v1/comments',
      body: args,
    });
  }

  list(args: {
    block_id?: string;
    page_id?: string;
    page_size?: number;
    start_cursor?: string;
  }): Promise<CommentListResponse> {
    return this.client.request<CommentListResponse>({
      method: 'GET',
      path: '/v1/comments',
      query: {
        ...(args.block_id !== undefined ? { block_id: args.block_id } : {}),
        ...(args.page_id !== undefined ? { page_id: args.page_id } : {}),
        ...(args.page_size !== undefined ? { page_size: args.page_size } : {}),
        ...(args.start_cursor !== undefined ? { start_cursor: args.start_cursor } : {}),
      },
    });
  }

  addReaction(args: { comment_id: string; emoji: string }): Promise<CommentObject> {
    return this.client.request<CommentObject>({
      method: 'POST',
      path: `/v1/comments/${args.comment_id}/reactions`,
      body: { emoji: args.emoji },
    });
  }

  removeReaction(args: { comment_id: string; emoji: string }): Promise<CommentObject> {
    return this.client.request<CommentObject>({
      method: 'DELETE',
      path: `/v1/comments/${args.comment_id}/reactions/${encodeURIComponent(args.emoji)}`,
    });
  }

  resolve(args: { comment_id: string }): Promise<DiscussionResolved> {
    return this.client.request<DiscussionResolved>({
      method: 'POST',
      path: `/v1/comments/${args.comment_id}/resolve`,
    });
  }
}
