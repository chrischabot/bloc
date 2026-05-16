# `bloc.users`

REST mapping: [`/v1/users`](../api/endpoints/users.md).

## Types

```ts
interface UserObject {
  object:      'user';
  id:          string;
  type:        'person' | 'bot';
  name:        string | null;
  avatar_url:  string | null;
  [key: string]: unknown;     // person? bot?
}

interface UserListResponse {
  object:      'list';
  type:        'user';
  results:     UserObject[];
  next_cursor: string | null;
  has_more:    boolean;
}
```

## `bloc.users.me() → Promise<UserObject>`

No arguments. Returns the user or bot associated with the bearer.

## `bloc.users.retrieve(args) → Promise<UserObject>`

```ts
args: { user_id: string }
```

## `bloc.users.list(args?) → Promise<UserListResponse>`

```ts
args: { start_cursor?: string; page_size?: number }
```

Defaults to `{}`.
