# Webhooks Endpoints

Subscribe to workspace events. Each event delivers a signed POST to the integration's `endpoint_url`.

## Subscription lifecycle

### `POST /v1/webhooks`

Create a subscription.

**Body**:
```jsonc
{
  "endpoint_url": "https://example.com/notion-hook",
  "subscribed_events": [
    "page.created","page.updated","page.archived",
    "block.appended","block.updated","block.deleted",
    "database.created","database.updated",
    "comment.created",
    "automation.run.completed",
    "form.submission.created"
  ],
  "filter": { "workspace_id": "uuid", "page_ids": ["..."] }   // optional scoping
}
```

**Response**:
```jsonc
{
  "object":"webhook",
  "id":"uuid",
  "endpoint_url":"https://...",
  "subscribed_events":[...],
  "signing_secret":"whsec_<43-char>",     // shown once
  "status":"unverified",                  // requires the verification handshake
  "created_at":"...",
  "filter":{ ... }
}
```

Immediately after creation, the server sends a one-off verification POST:

```
POST <endpoint_url>
Content-Type: application/json
X-Notion-Signature: sha256=<hex>
Notion-Webhook-Verification: true

{ "type":"verification", "token":"<one-time>", "webhook_id":"..." }
```

The endpoint MUST respond `200` with body `{ "token":"<same token>" }` within 10 s. On success the webhook flips to `status:"active"`.

### `GET /v1/webhooks` / `GET /v1/webhooks/:id` / `PATCH` / `DELETE`

Standard CRUD; `PATCH` re-triggers the verification handshake on `endpoint_url` change.

### `POST /v1/webhooks/:id/ping`

Sends a synthetic event for testing (delivery counts and logs included).

### `GET /v1/webhooks/:id/deliveries`

List recent deliveries (status, response code, latency, attempts).

## Event payload shape

```jsonc
{
  "id":"uuid",
  "type":"page.updated",
  "occurred_at":"iso8601",
  "workspace_id":"uuid",
  "data": { "page": { /* Page object snapshot */ } },
  "delivery_attempt": 1
}
```

Signed header: `X-Notion-Signature: sha256=<hex(hmac_sha256(signing_secret, raw_body))>`. Endpoints MUST verify.

## Delivery semantics

- At-least-once delivery.
- Retries: exponential backoff (1m, 5m, 30m, 2h, 8h), max 5 attempts.
- After all retries exhausted: webhook is auto-disabled, an audit event written, and an email sent to the workspace owner.
- Idempotency: each event has a unique `id`; receivers should dedupe.

## Subscribed event catalogue

| Event | Trigger |
|-------|---------|
| `page.created` | new page in workspace |
| `page.updated` | properties or content updated |
| `page.archived` | archived |
| `page.unarchived` | unarchived |
| `block.appended` | new block under a page subscribed-to |
| `block.updated` | block content patched |
| `block.deleted` | block archived |
| `database.created` | new database |
| `database.updated` | schema or settings updated |
| `comment.created` | comment posted |
| `comment.resolved` | discussion resolved |
| `automation.run.completed` | any automation run finishes |
| `form.submission.created` | form submission lands |
| `publication.created` | page published |
| `publication.deleted` | page unpublished |
| `wiki.verification.changed` | wiki page verified / expired |

### Explicitly **not** emitted

The webhook surface is deliberately scoped (mirroring Notion's GA contract):

- **No user events** — user creation, role changes, deactivation are **not** delivered. Poll `/v1/users` if you need this.
- **No workspace-settings events** — plan changes, allowed-domain edits, SSO config, billing changes are not delivered. Use the audit log if needed.
- **No `Notion-Version` events** — version migrations are not signalled.
- **Lightweight payloads** — the event carries identifiers and minimal context; consumers fetch the full object via the REST API. `data` snapshots are best-effort and may be truncated at 1 MB.

## Limits

- Max 100 webhooks per workspace.
- Max 25 subscribed events per webhook.
- Event payload size capped at 1 MB (truncated with `truncated: true` flag if larger).

## Observability

- Each delivery emits a `webhooks.deliver` span with `webhook_id`, `event_type`, `attempt`, `status_code`, `latency_ms`.
- Metrics: `webhooks_deliveries_total{event,status}`, `webhooks_retry_total`, `webhooks_active`.

## Tests

- Contract: each event type has a fixture event posted to a Vitest server; signature verified.
- Chaos: receiver returns 5xx → retries occur with the documented backoff schedule; receiver returns 410 → webhook auto-disabled; receiver responds slowly (> 10s) → recorded as timeout.
- Observability: an auto-disable produces an audit event + email.