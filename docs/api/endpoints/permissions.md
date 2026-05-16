# Permissions

Per-page ACL management.

## List grants

`GET /v1/pages/{page_id}/permissions`

```json
{
  "object": "list",
  "type": "permission",
  "results": [
    {
      "object": "permission",
      "id": "uuid",
      "grantee_type": "user" | "workspace" | "public" | "link" | "teamspace" | "group",
      "grantee_id":   "uuid" | null,
      "level":        "full_access" | "can_edit" | "can_edit_content" | "can_comment" | "can_read" | "no_access",
      "created_at":   "..."
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

## Grant

`POST /v1/pages/{page_id}/permissions`

```json
{
  "grantee_type": "user",
  "grantee_id":   "uuid",
  "level":        "can_edit"
}
```

`grantee_id` is omitted (or null) for `public` and `link` grantees.

## Revoke

`DELETE /v1/pages/{page_id}/permissions?grantee_id=<uuid>`

Omit `grantee_id` to revoke the page's `public` / `link` grant.

## Effective permission for me

`GET /v1/pages/{page_id}/permissions/me`

```json
{ "object": "permission", "level": "can_edit" }
```

Resolves the effective level for the caller, taking ancestor inheritance and group membership into account.

## Inheritance model

Permissions cascade from ancestors to descendants. A page without an explicit grant inherits its parent's resolved ACL. To break inheritance, grant any level explicitly on the page — including `no_access` to a specific grantee, which masks the inherited grant.
