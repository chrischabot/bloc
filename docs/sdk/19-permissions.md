# `bloc.permissions`

REST mapping: [`/v1/pages/{id}/permissions`](../api/endpoints/permissions.md).

## Types

```ts
type PermissionLevel = 'full_access' | 'can_edit' | 'can_edit_content' | 'can_comment' | 'can_read' | 'no_access';
type GranteeType    = 'user' | 'workspace' | 'public' | 'link' | 'teamspace' | 'group';

interface PermissionObject {
  object:       'permission';
  id:           string;
  grantee_type: GranteeType;
  grantee_id:   string | null;
  level:        PermissionLevel;
  created_at:   string;
}

interface PermissionListResponse {
  object:      'list';
  type:        'permission';
  results:     PermissionObject[];
  next_cursor: string | null;
  has_more:    boolean;
}
```

## `bloc.permissions.list(args) → Promise<PermissionListResponse>`

```ts
args: { page_id: string }
```

## `bloc.permissions.grant(args) → Promise<void>`

```ts
args: {
  page_id:      string;
  grantee_type: GranteeType;
  grantee_id?:  string | null;       // omitted for 'public' / 'link'
  level:        PermissionLevel;
}
```

## `bloc.permissions.revoke(args) → Promise<void>`

```ts
args: { page_id: string; grantee_id?: string }
```

Omit `grantee_id` to revoke the page's `public` / `link` grant.

## `bloc.permissions.me(args) → Promise<{ object: 'permission'; level: PermissionLevel }>`

```ts
args: { page_id: string }
```

Returns the caller's effective level on the page, accounting for inheritance and group membership.
