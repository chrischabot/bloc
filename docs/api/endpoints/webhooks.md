# Webhooks

Endpoints under `/v1/webhooks`. Required scope: `manage_webhooks`.

## Create a webhook

`POST /v1/webhooks`

```json
{
  "endpoint_url": "https://example.com/hook",
  "subscribed_events": [
    "page.created", "page.updated", "page.deleted",
    "block.created", "block.updated", "block.deleted",
    "comment.created", "comment.updated", "comment.deleted",
    "database.created", "database.updated", "database.deleted"
  ],
  "filter": { /* optional, see below */ }
}
```

Response:

```json
{
  "object": "webhook",
  "id": "uuid",
  "endpoint_url": "...",
  "subscribed_events": [...],
  "status": "verification",
  "enabled": true,
  "failure_streak": 0,
  "filter": { ... },
  "created_at": "...",
  "updated_at": "...",
  "signing_secret": "whsec_…",        // returned once, on create
  "verification":   { "ok": true, "status": 200 }
}
```

**The `signing_secret` is returned exactly once.** Store it; you can't retrieve it later. Rotate by deleting and re-creating the webhook.

## List webhooks

`GET /v1/webhooks`

## Retrieve a webhook

`GET /v1/webhooks/{webhook_id}`

## Update a webhook

`PATCH /v1/webhooks/{webhook_id}`

Updates any of `endpoint_url`, `subscribed_events`, `filter`. Updating `endpoint_url` retriggers verification.

## Delete a webhook

`DELETE /v1/webhooks/{webhook_id}` → `204`.

## Ping a webhook

`POST /v1/webhooks/{webhook_id}/ping`

Sends a synthetic `webhook.ping` event and returns:

```json
{ "delivered": 1, "succeeded": 1, "failed": 0 }
```

## Deliveries

`GET /v1/webhooks/{webhook_id}/deliveries`

Returns the recent attempts. Useful for debugging delivery failures.

```json
{
  "object": "list",
  "type": "webhook_delivery",
  "results": [
    {
      "object": "webhook_delivery",
      "id": "uuid",
      "webhook_id": "uuid",
      "event_id": "uuid",
      "event_type": "page.updated",
      "status": "success" | "failed" | "pending" | "verification",
      "http_status": 200 | null,
      "attempt": 1,
      "latency_ms": 142,
      "error": null | "...",
      "created_at": "..."
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

## Verification

On create or after `endpoint_url` changes, Bloc sends a single `webhook.verification` request:

```http
POST /your/hook
Content-Type: application/json
X-Bloc-Signature: t=...,v1=...
X-Bloc-Event:     webhook.verification

{ "type": "webhook.verification", "challenge": "..." }
```

Echo the `challenge` field in the body of a `200 OK` response, signed appropriately (or just return the JSON unchanged — Bloc accepts both forms). If the verification round-trips successfully, `status` flips from `verification` to `active`.

## Signature

Every delivery carries `X-Bloc-Signature: t=<unix_ts>,v1=<hex_hmac>`. The HMAC is `SHA256(signing_secret, "<t>.<raw_body>")`.

Verification recipe:

```ts
import crypto from 'node:crypto';

function verify(secret: string, header: string, rawBody: string): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const ts = parts['t']!;
  const sig = parts['v1']!;
  const mac = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  // Reject if older than 5 minutes.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig));
}
```

## Delivery semantics

- **At-least-once.** A receiver may see the same event twice; dedupe on `event_id`.
- **Retry policy.** Failed deliveries (non-2xx, timeout > 5 s, signature-rejected by you) are retried with exponential backoff (1 s, 2 s, 4 s, …, up to 60 s) for up to 24 h.
- **Failure streak.** After 20 consecutive failures the webhook is disabled (`enabled: false`). Re-enable manually via `PATCH`.
- **Ordering.** Best-effort, not guaranteed.

## Event catalogue

See [end-user automations docs](../../apps/automations.md#event-catalogue) for the full list. The catalogue is intentionally narrower than Notion's internal one — events the public API can't reproduce reliably are excluded.
