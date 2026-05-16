import type { BlocClient } from './client.ts';

export interface DataSourceObject {
  object: 'data_source';
  id: string;
  database_id: string;
  name: string;
  type: 'owned' | 'linked';
  linked_from: { database_id: string; data_source_id: string } | null;
  archived: boolean;
  created_time: string;
  last_edited_time: string;
}

export interface DataSourceQueryResponse {
  object: 'list';
  type: 'page_or_data_source';
  results: Array<Record<string, unknown>>;
  next_cursor: string | null;
  has_more: boolean;
}

export class DataSourcesNamespace {
  constructor(private readonly client: BlocClient) {}

  create(args: {
    database_id: string;
    name: string;
    type?: 'owned' | 'linked';
    source_data_source_id?: string;
  }): Promise<DataSourceObject> {
    const { database_id, ...rest } = args;
    return this.client.request({
      method: 'POST',
      path: `/v1/databases/${database_id}/data_sources`,
      body: { database_id, ...rest },
    });
  }

  listForDatabase(args: { database_id: string }): Promise<{
    object: 'list';
    type: 'data_source';
    results: DataSourceObject[];
    next_cursor: string | null;
    has_more: boolean;
  }> {
    return this.client.request({
      method: 'GET',
      path: `/v1/databases/${args.database_id}/data_sources`,
    });
  }

  retrieve(args: { data_source_id: string }): Promise<DataSourceObject> {
    return this.client.request({
      method: 'GET',
      path: `/v1/data_sources/${args.data_source_id}`,
    });
  }

  update(args: {
    data_source_id: string;
    name?: string;
    archived?: boolean;
  }): Promise<DataSourceObject> {
    const { data_source_id, ...rest } = args;
    return this.client.request({
      method: 'PATCH',
      path: `/v1/data_sources/${data_source_id}`,
      body: rest,
    });
  }

  delete(args: { data_source_id: string }): Promise<void> {
    return this.client.request({
      method: 'DELETE',
      path: `/v1/data_sources/${args.data_source_id}`,
    });
  }

  query(args: {
    data_source_id: string;
    filter?: Record<string, unknown>;
    sorts?: Array<Record<string, unknown>>;
    start_cursor?: string;
    page_size?: number;
  }): Promise<DataSourceQueryResponse> {
    const { data_source_id, ...rest } = args;
    return this.client.request({
      method: 'POST',
      path: `/v1/data_sources/${data_source_id}/query`,
      body: rest,
    });
  }
}
