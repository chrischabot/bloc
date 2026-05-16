import type { BlocClient } from './client.ts';

export interface InboxEntry {
  object: 'inbox_entry';
  id: string;
  kind: 'mention' | 'comment' | 'page_update';
  actor_user_id: string | null;
  target_page_id: string;
  snippet: string | null;
  created_at: string;
}

export interface InboxListResponse {
  object: 'list';
  type: 'inbox_entry';
  results: InboxEntry[];
  next_cursor: string | null;
  has_more: boolean;
}

export class InboxNamespace {
  constructor(private readonly client: BlocClient) {}

  list(
    args: {
      kind?: 'all' | 'mention' | 'comment' | 'page_update';
      since?: string;
      page_size?: number;
    } = {},
  ): Promise<InboxListResponse> {
    return this.client.request<InboxListResponse>({
      method: 'GET',
      path: '/v1/inbox',
      query: {
        ...(args.kind !== undefined ? { kind: args.kind } : {}),
        ...(args.since !== undefined ? { since: args.since } : {}),
        ...(args.page_size !== undefined ? { page_size: args.page_size } : {}),
      },
    });
  }
}
