# Users

Endpoints under `/v1/users`.

## Me

`GET /v1/users/me`

Returns the user or bot the bearer represents.

```json
{
  "object": "user",
  "id": "uuid",
  "type": "person" | "bot",
  "name": "...",
  "avatar_url": "...",
  "person": { "email": "..." }              // when type == 'person'
  "bot":    { "owner": ..., "workspace_name": ... }   // when type == 'bot'
}
```

## Retrieve a user

`GET /v1/users/{user_id}`

## List users

`GET /v1/users?page_size=…&start_cursor=…`

Returns all users in the workspace, paginated.

## Workspace members (admin)

`GET /v1/workspaces/me/members` — list members with role.

`PATCH /v1/workspaces/me/members/{user_id}`

```json
{ "role": "admin" | "member" }
```

`DELETE /v1/workspaces/me/members/{user_id}` — remove a member.

These require the `manage_users` scope or an `admin` workspace role.
