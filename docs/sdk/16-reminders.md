# `bloc.reminders`

REST mapping: [`/v1/reminders`](../api/endpoints/reminders.md).

## Types

```ts
interface ReminderObject {
  object:       'reminder';
  id:           string;
  workspace_id: string;
  parent:       { type: 'page' | 'block'; id: string };
  user_id:      string;
  due_at:       string;
  label:        string | null;
  fired:        boolean;
  fired_at:     string | null;
  created_by:   string;
  created_at:   string;
}

interface ReminderListResponse {
  object:      'list';
  type:        'reminder';
  results:     ReminderObject[];
  next_cursor: string | null;
  has_more:    boolean;
}
```

## `bloc.reminders.create(args) → Promise<ReminderObject>`

```ts
args: {
  parent:   { type: 'page' | 'block'; id: string };
  due_at:   string;                   // ISO 8601
  label?:   string;
  user_id?: string;                   // defaults to the caller
}
```

## `bloc.reminders.list(args?) → Promise<ReminderListResponse>`

```ts
args: { include_fired?: boolean; page_size?: number }
```

## `bloc.reminders.retrieve(args) → Promise<ReminderObject>`

```ts
args: { reminder_id: string }
```

## `bloc.reminders.fire(args) → Promise<ReminderObject>`

```ts
args: { reminder_id: string }
```

Manually fire the reminder (sets `fired: true`, `fired_at: now`).

## `bloc.reminders.delete(args) → Promise<void>`

```ts
args: { reminder_id: string }
```

## `bloc.reminders.scanDue() → Promise<ReminderListResponse & { now: string }>`

No arguments. Returns the set of reminders that are due but haven't fired. Used by the worker; callable manually for diagnostics.
