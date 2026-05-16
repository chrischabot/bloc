import type { BlocClient } from './client.ts';

export type PermissionLevel =
  | 'full_access'
  | 'can_edit'
  | 'can_edit_content'
  | 'can_comment'
  | 'can_read'
  | 'no_access';

export type GranteeType = 'user' | 'workspace' | 'public' | 'link' | 'teamspace' | 'group';

export interface PermissionObject {
  object: 'permission';
  id: string;
  grantee_type: GranteeType;
  grantee_id: string | null;
  level: PermissionLevel;
  created_at: string;
}

export interface PermissionListResponse {
  object: 'list';
  type: 'permission';
  results: PermissionObject[];
  next_cursor: string | null;
  has_more: boolean;
}

export class PermissionsNamespace {
  constructor(private readonly client: BlocClient) {}

  list(args: { page_id: string }): Promise<PermissionListResponse> {
    return this.client.request<PermissionListResponse>({
      method: 'GET',
      path: `/v1/pages/${args.page_id}/permissions`,
    });
  }

  grant(args: {
    page_id: string;
    grantee_type: GranteeType;
    grantee_id?: string | null;
    level: PermissionLevel;
  }): Promise<void> {
    const { page_id, ...rest } = args;
    return this.client.request<void>({
      method: 'POST',
      path: `/v1/pages/${page_id}/permissions`,
      body: rest,
    });
  }

  revoke(args: { page_id: string; grantee_id?: string }): Promise<void> {
    const query = args.grantee_id !== undefined ? { grantee_id: args.grantee_id } : {};
    return this.client.request<void>({
      method: 'DELETE',
      path: `/v1/pages/${args.page_id}/permissions`,
      query,
    });
  }

  me(args: { page_id: string }): Promise<{ object: 'permission'; level: PermissionLevel }> {
    return this.client.request({
      method: 'GET',
      path: `/v1/pages/${args.page_id}/permissions/me`,
    });
  }
}
