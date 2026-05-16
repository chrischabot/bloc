import type { BlocClient } from './client.ts';

export interface V3RecordMap {
  block?: Record<string, { role: string; value: Record<string, unknown> }>;
  space?: Record<string, { role: string; value: Record<string, unknown> }>;
  collection?: Record<string, { role: string; value: Record<string, unknown> }>;
  collection_view?: Record<string, { role: string; value: Record<string, unknown> }>;
  notion_user?: Record<string, { role: string; value: Record<string, unknown> }>;
  discussion?: Record<string, { role: string; value: Record<string, unknown> }>;
  comment?: Record<string, { role: string; value: Record<string, unknown> }>;
}

export interface V3LoadPageChunkResponse {
  recordMap: V3RecordMap;
  cursor: { stack: unknown[] };
}

export interface V3GetRecordValuesResponse {
  results: Array<{ role: string; value: Record<string, unknown> } | null>;
}

export interface V3SyncRecordValuesResponse {
  recordMap: V3RecordMap;
}

export interface V3SubmitTransactionResponse {
  object: 'transaction_result';
  applied: number;
  skipped: number;
}

export interface V3LoadUserContentResponse {
  recordMap: V3RecordMap;
}

export interface V3QueryCollectionResponse {
  recordMap: V3RecordMap;
  result: {
    type: string;
    blockIds: string[];
    total: number;
    reducerResults?: Record<string, unknown>;
    aggregationResults?: unknown[];
    sizeHint?: number;
  };
}

export type V3Table =
  | 'block'
  | 'space'
  | 'collection'
  | 'collection_view'
  | 'notion_user'
  | 'discussion'
  | 'comment';

export type V3Command = 'set' | 'update' | 'listAfter' | 'listBefore' | 'listRemove';

export interface V3Operation {
  id: string;
  table: V3Table;
  path: string[];
  command: V3Command;
  args: unknown;
}

export interface V3Transaction {
  id?: string;
  spaceId: string;
  operations: V3Operation[];
}

export class V3Namespace {
  constructor(private readonly client: BlocClient) {}

  loadPageChunk(args: {
    pageId: string;
    limit?: number;
    chunkNumber?: number;
  }): Promise<V3LoadPageChunkResponse> {
    return this.client.request<V3LoadPageChunkResponse>({
      method: 'POST',
      path: '/api/v3/loadPageChunk',
      body: args,
    });
  }

  getRecordValues(args: {
    requests: Array<{ table: V3Table; id: string }>;
  }): Promise<V3GetRecordValuesResponse> {
    return this.client.request<V3GetRecordValuesResponse>({
      method: 'POST',
      path: '/api/v3/getRecordValues',
      body: args,
    });
  }

  syncRecordValues(args: {
    requests: Array<{ pointer: { table: V3Table; id: string }; version: number }>;
  }): Promise<V3SyncRecordValuesResponse> {
    return this.client.request<V3SyncRecordValuesResponse>({
      method: 'POST',
      path: '/api/v3/syncRecordValues',
      body: args,
    });
  }

  submitTransaction(args: {
    requestId?: string;
    transactions: V3Transaction[];
  }): Promise<V3SubmitTransactionResponse> {
    return this.client.request<V3SubmitTransactionResponse>({
      method: 'POST',
      path: '/api/v3/submitTransaction',
      body: args,
    });
  }

  loadUserContent(): Promise<V3LoadUserContentResponse> {
    return this.client.request<V3LoadUserContentResponse>({
      method: 'POST',
      path: '/api/v3/loadUserContent',
      body: {},
    });
  }

  queryCollection(args: {
    collection: { id: string };
    collectionView?: { id: string };
    loader?: {
      type?: string;
      limit?: number;
      searchQuery?: string;
      filter?: Record<string, unknown>;
      sort?: Array<Record<string, unknown>>;
    };
  }): Promise<V3QueryCollectionResponse> {
    return this.client.request<V3QueryCollectionResponse>({
      method: 'POST',
      path: '/api/v3/queryCollection',
      body: args,
    });
  }

  queryCollectionV2(
    args: Parameters<V3Namespace['queryCollection']>[0],
  ): Promise<V3QueryCollectionResponse> {
    return this.client.request<V3QueryCollectionResponse>({
      method: 'POST',
      path: '/api/v3/queryCollectionV2',
      body: args,
    });
  }
}
