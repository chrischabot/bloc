import type { BlocClient } from './client.ts';

export interface UserObject {
  object: 'user';
  id: string;
  type: 'person' | 'bot';
  name: string | null;
  avatar_url: string | null;
  [key: string]: unknown;
}

export interface UserListResponse {
  object: 'list';
  type: 'user';
  results: UserObject[];
  next_cursor: string | null;
  has_more: boolean;
}

export class UsersNamespace {
  constructor(private readonly client: BlocClient) {}

  me(): Promise<UserObject> {
    return this.client.request<UserObject>({ method: 'GET', path: '/v1/users/me' });
  }

  retrieve(args: { user_id: string }): Promise<UserObject> {
    return this.client.request<UserObject>({
      method: 'GET',
      path: `/v1/users/${args.user_id}`,
    });
  }

  list(args: { start_cursor?: string; page_size?: number } = {}): Promise<UserListResponse> {
    return this.client.request<UserListResponse>({
      method: 'GET',
      path: '/v1/users',
      query: {
        ...(args.start_cursor !== undefined ? { start_cursor: args.start_cursor } : {}),
        ...(args.page_size !== undefined ? { page_size: args.page_size } : {}),
      },
    });
  }
}
