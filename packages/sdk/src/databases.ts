import type { BlocClient } from './client.ts';

export interface DatabaseObject {
  object: 'database';
  id: string;
  parent: Record<string, unknown>;
  created_time: string;
  last_edited_time: string;
  title: unknown;
  description: unknown;
  properties: Record<string, unknown>;
  url: string;
  archived: boolean;
  in_trash: boolean;
  is_inline: boolean;
  public_url: string | null;
  [key: string]: unknown;
}

export interface DatabaseQueryResponse {
  object: 'list';
  type: 'page_or_database';
  results: Array<Record<string, unknown>>;
  next_cursor: string | null;
  has_more: boolean;
}

export class DatabasesNamespace {
  constructor(private readonly client: BlocClient) {}

  create(args: {
    parent: Record<string, unknown>;
    title?: unknown[];
    description?: unknown[];
    icon?: unknown;
    cover?: unknown;
    is_inline?: boolean;
    properties: Record<string, { type: string; [key: string]: unknown }>;
  }): Promise<DatabaseObject> {
    return this.client.request<DatabaseObject>({
      method: 'POST',
      path: '/v1/databases',
      body: args,
    });
  }

  retrieve(args: { database_id: string }): Promise<DatabaseObject> {
    return this.client.request<DatabaseObject>({
      method: 'GET',
      path: `/v1/databases/${args.database_id}`,
    });
  }

  update(args: { database_id: string } & Record<string, unknown>): Promise<DatabaseObject> {
    const { database_id, ...rest } = args;
    return this.client.request<DatabaseObject>({
      method: 'PATCH',
      path: `/v1/databases/${database_id}`,
      body: rest,
    });
  }

  query(args: {
    database_id: string;
    filter?: Record<string, unknown>;
    sorts?: Array<Record<string, unknown>>;
    start_cursor?: string;
    page_size?: number;
  }): Promise<DatabaseQueryResponse> {
    const { database_id, ...rest } = args;
    return this.client.request<DatabaseQueryResponse>({
      method: 'POST',
      path: `/v1/databases/${database_id}/query`,
      body: rest,
    });
  }
}
