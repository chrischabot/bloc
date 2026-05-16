# Users Endpoints

## `GET /v1/users/me`

Returns the bot or user that owns the bearer token (or session).

**Response** (200): `User`.

## `GET /v1/users/{user_id}`

**Response** (200): `User`.

## `GET /v1/users`

List users in the workspace.

**Query**: `start_cursor`, `page_size`.

**Response** (200):

```jsonc
{ "object":"list", "type":"user", "results": [ /* User[] */ ], "next_cursor":"...|null", "has_more": true|false, "user": {} }
```

## `User` object

```jsonc
{
  "object": "user",
  "id": "uuid",
  "type": "person" | "bot",
  "name": "Alice",
  "avatar_url": "https://..." | null,
  "person": { "email": "alice@example.com" },     // when type=person
  "bot": {                                         // when type=bot
    "owner": { "type": "workspace" | "user", "workspace": true } | { "type":"user","user":{...} },
    "workspace_name": "Acme"
  }
}
```

- `person.email` is included only if the bearer has the "Read user info with email" capability; otherwise omitted (not null).

## Test obligations

- Contract: capability-scoped email visibility, workspace scoping.
- SDK-progressive: `client.users.me`, `.retrieve`, `.list`.