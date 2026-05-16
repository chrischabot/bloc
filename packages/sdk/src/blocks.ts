import type { BlocClient } from './client.ts';

export interface BlockObject {
  object: 'block';
  id: string;
  type: string;
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  parent: Record<string, unknown>;
  created_time: string;
  last_edited_time: string;
  created_by: { object: 'user'; id: string };
  last_edited_by: { object: 'user'; id: string };
  [key: string]: unknown;
}

export interface BlockListResponse {
  object: 'list';
  type: 'block';
  results: BlockObject[];
  next_cursor: string | null;
  has_more: boolean;
}

export class BlocksChildrenNamespace {
  constructor(private readonly client: BlocClient) {}

  list(args: {
    block_id: string;
    start_cursor?: string;
    page_size?: number;
  }): Promise<BlockListResponse> {
    return this.client.request<BlockListResponse>({
      method: 'GET',
      path: `/v1/blocks/${args.block_id}/children`,
      query: {
        ...(args.start_cursor !== undefined ? { start_cursor: args.start_cursor } : {}),
        ...(args.page_size !== undefined ? { page_size: args.page_size } : {}),
      },
    });
  }

  append(args: {
    block_id: string;
    children: Array<{ type: string; [key: string]: unknown }>;
    after?: string;
  }): Promise<BlockListResponse> {
    const body: Record<string, unknown> = { children: args.children };
    if (args.after !== undefined) body['after'] = args.after;
    return this.client.request<BlockListResponse>({
      method: 'PATCH',
      path: `/v1/blocks/${args.block_id}/children`,
      body,
    });
  }
}

export class BlocksNamespace {
  readonly children: BlocksChildrenNamespace;
  constructor(private readonly client: BlocClient) {
    this.children = new BlocksChildrenNamespace(client);
  }

  retrieve(args: { block_id: string }): Promise<BlockObject> {
    return this.client.request<BlockObject>({
      method: 'GET',
      path: `/v1/blocks/${args.block_id}`,
    });
  }

  update(args: { block_id: string } & Record<string, unknown>): Promise<BlockObject> {
    const { block_id, ...rest } = args;
    return this.client.request<BlockObject>({
      method: 'PATCH',
      path: `/v1/blocks/${block_id}`,
      body: rest,
    });
  }

  delete(args: { block_id: string }): Promise<BlockObject> {
    return this.client.request<BlockObject>({
      method: 'DELETE',
      path: `/v1/blocks/${args.block_id}`,
    });
  }
}
