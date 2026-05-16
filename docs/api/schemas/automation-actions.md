# Automation Action Schemas

Every step is `{ "type": "<step>", ... }`. Templated strings use `{{<path>}}` syntax — see `docs/frontend/20-buttons-automations.md#variable-bag`.

## `add_page_to_database`

```jsonc
{
  "type": "add_page_to_database",
  "database_id": "uuid",
  "properties": {
    "Name": { "title": [{ "type":"text","text":{"content":"{{trigger.property.new}}"}}] },
    "Status": { "status": { "name": "To do" } }
  },
  "children": [ /* optional initial Block[] (max 100) */ ]
}
```

Output bag: `{ page_id }`.

## `edit_pages_in_database`

```jsonc
{
  "type": "edit_pages_in_database",
  "database_id": "uuid",
  "filter": { /* filter object; defaults to all rows */ },
  "set": { "Status": { "status": { "name": "Archived" } } },
  "limit": 100
}
```

Output: `{ matched, updated }`.

## `edit_property`

```jsonc
{
  "type": "edit_property",
  "page_id": "uuid | {{page.id}}",
  "property": "Status",
  "value": { "status": { "name": "Done" } }
}
```

## `set_page_property` — alias of `edit_property` with explicit page target.

## `send_slack_message`

```jsonc
{
  "type": "send_slack_message",
  "channel": "#proj-x | C012345",
  "body": "Task {{page.title}} moved to Done",
  "mention_user_ids": [ "U_slack_id" ]
}
```

Requires a Slack integration connected to the workspace.

## `send_email`

```jsonc
{
  "type": "send_email",
  "to": ["{{actor.email}}", "alex@example.com"],
  "subject": "...",
  "body": "..."        // plain or markdown
}
```

## `send_notification`

```jsonc
{
  "type": "send_notification",
  "recipients": ["{{actor.id}}", "<user-uuid>"],
  "body": "Page {{page.title}} updated."
}
```

## `open_page` (button only)

```jsonc
{ "type":"open_page", "page_id":"uuid | {{result.0.page_id}}" }
```

## `open_link` (button only)

```jsonc
{ "type":"open_link", "url":"https://..." }
```

## `show_confirm` (button only, sync)

```jsonc
{ "type":"show_confirm", "message":"Are you sure?" }
```

If the user dismisses, subsequent steps are skipped (run status `partial`).

## `run_ai`

```jsonc
{
  "type":"run_ai",
  "prompt":"Summarize {{page.body}} in 3 bullets.",
  "output_property":"Summary"
}
```

Writes the AI completion to the named property on the trigger page.

## `delay` (automations only)

```jsonc
{ "type":"delay", "duration":"PT15M" }    // ISO 8601 duration, max P30D
```

## Validation

`packages/shared/src/automations/*.ts` exports a Zod schema per step + a discriminated-union schema. Unknown step types → 400 `invalid_request`.

## Tests

- Per step: unit (parse + run with mocked side effects).
- Integration: every step end-to-end against real services where possible.
- Chaos: templating recursion bombs, unbounded loops via `delay` + property-change re-trigger (detected and aborted).