# `bloc.inbox`

REST mapping: [`/v1/inbox`](../api/endpoints/inbox.md).

## Types

```ts
interface InboxEntry {
  object:          'inbox_entry';
  id:              string;
  kind:            'mention' | 'comment' | 'page_update';
  actor_user_id:   string | null;
  target_page_id:  string;
  snippet:         string | null;
  created_at:      string;
}

interface InboxListResponse {
  object:      'list';
  type:        'inbox_entry';
  results:     InboxEntry[];
  next_cursor: string | null;
  has_more:    boolean;
}
```

## `bloc.inbox.list(args?) → Promise<InboxListResponse>`

```ts
args: {
  kind?:      'all' | 'mention' | 'comment' | 'page_update';
  since?:     string;     // ISO 8601 cutoff
  page_size?: number;
}
```

Defaults to `{}` (`kind: 'all'`).
