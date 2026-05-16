# Automations & buttons

Database-scoped triggers that run a sequence of steps. Buttons are blocks that invoke an automation on click.

## Triggers

| Trigger type | Fires when |
|---|---|
| `page_created` | New row in the database |
| `page_property_changed` | Property changes (optionally `to: <value>` / `from: <value>`) |
| `page_property_within_offset` | Date property crosses a relative threshold (`offset: "1d"`) |
| `button_clicked` | Button block invoked |
| `scheduled` | Cron in workspace TZ (`schedule: "0 9 * * 1-5"`) |

## Steps

| Step type | Notes |
|---|---|
| `update_property` | Patch a property on the trigger page (or `target_page_id`) |
| `add_child_block` | Append blocks under a target page |
| `send_webhook` | POST JSON to `url` |
| `send_email` | SMTP — templated subject/body using property substitutions (`{{prop:Name}}`) |
| `create_page` | Create a row in another database |
| `ai_completion` | Call `/v1/ai/completions` with a templated prompt |
| `wait` | `seconds: N` — chains delayed effects |

Each step has optional `on_error: "stop" | "skip"` (default `stop`).

## Event catalogue (for webhooks)

The events Bloc emits to subscribed webhooks:

- `page.created`, `page.updated`, `page.deleted`, `page.restored`
- `block.created`, `block.updated`, `block.deleted`
- `database.created`, `database.updated`, `database.deleted`
- `data_source.created`, `data_source.updated`, `data_source.deleted`
- `comment.created`, `comment.updated`, `comment.deleted`, `comment.resolved`
- `automation.ran`
- `form.submitted`
- `reminder.fired`
- `webhook.ping`, `webhook.verification`

Excluded by design (not in Notion's public catalogue either):

- user-row changes
- workspace settings changes
- realtime presence

Each event body is documented inline in the SDK types; see also [API › Webhooks](../api/endpoints/webhooks.md).

## Building automations

UI: open the database, settings → Automations → New. Or, API:

```ts
await bloc.automations.create({
  database_id,
  name: 'Email owner on Status=Done',
  trigger: { type: 'page_property_changed', property: 'Status', to: 'Done' },
  steps: [
    { type: 'send_email', to: '{{prop:Owner.email}}', subject: 'Done: {{prop:Title}}', body: '...' },
    { type: 'update_property', property: 'Done at', value: { date: { start: 'now()' } } },
  ],
  enabled: true,
});
```

## Buttons

Insert a button block (`/button`). Configure label + automation. On click:

```ts
await bloc.buttons.invoke({ block_id, context: { /* free-form */ } });
```

The `context` is available to step expressions via `{{ctx:<key>}}`.

## Testing

Before enabling a real-world automation, dry-run it:

```ts
const run = await bloc.automations.test({
  automation_id,
  sample_page_id: somePageInTheDB,
  context: { ... }
});
```

`run.steps[i]` shows what each step *would* do, with output and error fields populated.

## Limits

- Max steps per automation: 25.
- Max scheduled automations per workspace: 100.
- Per-step timeout: 30 s (webhook), 60 s (AI completion), 5 s (others).
- Loops & recursion: an automation cannot trigger itself; cycles are detected and broken with a `failed: cycle` step.
