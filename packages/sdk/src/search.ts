import type { BlocClient } from './client.ts';

export interface SearchResponse {
  object: 'list';
  type: 'page_or_database';
  results: Array<Record<string, unknown>>;
  next_cursor: string | null;
  has_more: boolean;
}

export class SearchNamespace {
  constructor(private readonly client: BlocClient) {}

  call(
    args: {
      query?: string;
      sort?: { direction: 'ascending' | 'descending'; timestamp: 'last_edited_time' };
      filter?: { value: 'page' | 'database'; property: 'object' };
      page_size?: number;
      start_cursor?: string;
    } = {},
  ): Promise<SearchResponse> {
    return this.client.request<SearchResponse>({
      method: 'POST',
      path: '/v1/search',
      body: args,
    });
  }
}
