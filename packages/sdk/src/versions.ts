import type { BlocClient } from './client.ts';

export interface PageVersion {
  object: 'page_version';
  page_id: string;
  clock: number;
  created_at: string;
  update_bytes: number;
}

export interface PageVersionSnapshot {
  object: 'page_version_snapshot';
  page_id: string;
  clock: number;
  created_at: string;
  update_bytes: number;
  updates_through_clock: number;
  recordMap: Record<string, unknown>;
  notes: string[];
}

export class VersionsNamespace {
  constructor(private readonly client: BlocClient) {}

  list(args: { page_id: string; page_size?: number; start_cursor?: string }): Promise<{
    object: 'list';
    type: 'page_version';
    results: PageVersion[];
    next_cursor: string | null;
    has_more: boolean;
  }> {
    return this.client.request({
      method: 'GET',
      path: `/v1/pages/${args.page_id}/versions`,
      query: {
        ...(args.page_size !== undefined ? { page_size: args.page_size } : {}),
        ...(args.start_cursor !== undefined ? { start_cursor: args.start_cursor } : {}),
      },
    });
  }

  retrieve(args: { page_id: string; clock: number }): Promise<PageVersionSnapshot> {
    return this.client.request<PageVersionSnapshot>({
      method: 'GET',
      path: `/v1/pages/${args.page_id}/versions/${args.clock}`,
    });
  }
}
