# `bloc.webhooks`

REST mapping: [`/v1/webhooks`](../api/endpoints/webhooks.md). Required scope: `manage_webhooks`.

## Types

```ts
interface WebhookObject {
  object:            'webhook';
  id:                string;
  endpoint_url:      string;
  subscribed_events: string[];
  status:            string;          // 'verification' | 'active' | 'disabled'
  enabled:           boolean;
  failure_streak:    number;
  filter:            Record<string, unknown>;
  created_at:        string;
  updated_at:        string;
  signing_secret?:   string;          // returned only on create
  verification?:     { ok: boolean; status: number };
}

interface WebhookDeliveryObject {
  object:       'webhook_delivery';
  id:           string;
  webhook_id:   string;
  event_id:     string;
  event_type:   string;
  status:       'pending' | 'success' | 'failed' | 'verification';
  http_status:  number | null;
  attempt:      number;
  latency_ms:   number | null;
  error:        string | null;
  created_at:   string;
}
```

## `bloc.webhooks.create(args) → Promise<WebhookObject>`

```ts
args: {
  endpoint_url:      string;
  subscribed_events: string[];
  filter?:           Record<string, unknown>;
}
```

Returns the freshly created webhook **with** `signing_secret`. Persist it; it's not retrievable later.

## `bloc.webhooks.list() → Promise<...>`

No arguments.

## `bloc.webhooks.retrieve(args) → Promise<WebhookObject>`

```ts
args: { webhook_id: string }
```

## `bloc.webhooks.update(args) → Promise<WebhookObject>`

```ts
args: { webhook_id: string } & Partial<{
  endpoint_url:      string;
  subscribed_events: string[];
  filter:            Record<string, unknown>;
}>
```

## `bloc.webhooks.delete(args) → Promise<void>`

```ts
args: { webhook_id: string }
```

## `bloc.webhooks.ping(args) → Promise<{ delivered: number; succeeded: number; failed: number }>`

```ts
args: { webhook_id: string }
```

Sends a synthetic `webhook.ping` event.

## `bloc.webhooks.deliveries.list(args) → Promise<...>`

```ts
args: { webhook_id: string }
```

Returns the delivery log for the webhook.
