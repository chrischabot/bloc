# `bloc.comments`

REST mapping: [`/v1/comments`](../api/endpoints/comments.md).

## Types

```ts
interface CommentReactionGroup {
  emoji:    string;
  count:    number;
  user_ids: string[];
}

interface CommentObject {
  object:           'comment';
  id:               string;
  parent:           Record<string, unknown>;
  discussion_id:    string;
  created_time:     string;
  last_edited_time: string;
  created_by:       { object: 'user'; id: string };
  rich_text:        unknown;                  // RichText[]
  reactions?:       CommentReactionGroup[];
}

interface CommentListResponse {
  object:      'list';
  type:        'comment';
  results:     CommentObject[];
  next_cursor: string | null;
  has_more:    boolean;
}

interface DiscussionResolved {
  object:   'discussion';
  id:       string;
  resolved: boolean;
}
```

## `bloc.comments.create(args) → Promise<CommentObject>`

```ts
args: {
  parent?:        { page_id?: string; block_id?: string };
  discussion_id?: string;
  rich_text:      Array<Record<string, unknown>>;
}
```

Either `parent` (new discussion) or `discussion_id` (reply) — not both.

## `bloc.comments.list(args) → Promise<CommentListResponse>`

```ts
args: {
  block_id?:    string;
  page_id?:     string;
  page_size?:   number;
  start_cursor?: string;
}
```

## `bloc.comments.addReaction(args) → Promise<CommentObject>`

```ts
args: { comment_id: string; emoji: string }
```

## `bloc.comments.removeReaction(args) → Promise<CommentObject>`

```ts
args: { comment_id: string; emoji: string }
```

The emoji is URL-encoded by the SDK.

## `bloc.comments.resolve(args) → Promise<DiscussionResolved>`

```ts
args: { comment_id: string }
```

Resolves the discussion the comment belongs to.
