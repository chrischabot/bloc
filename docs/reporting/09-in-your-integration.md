# Reporting in your integration

Patterns for instrumenting code that *calls* Bloc.

## Trace every SDK call

Wrap the SDK's `fetch`:

```ts
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer('my-integration');

const bloc = new Bloc({
  auth, baseUrl,
  fetch: async (url, init) => {
    return tracer.startActiveSpan('bloc.request', async (span) => {
      span.setAttribute('http.url', String(url));
      span.setAttribute('http.method', String(init?.method ?? 'GET'));
      try {
        const res = await globalThis.fetch(url, init);
        span.setAttribute('http.status_code', res.status);
        return res;
      } catch (e) {
        span.recordException(e as Error);
        throw e;
      } finally {
        span.end();
      }
    });
  }
});
```

## Record the `X-Request-Id`

Echo it into your own logs and traces so you can correlate with Bloc-side logs.

```ts
const bloc = new Bloc({
  auth, baseUrl,
  fetch: async (url, init) => {
    const res = await globalThis.fetch(url, init);
    const requestId = res.headers.get('x-request-id');
    if (requestId) logger.info({ blocRequestId: requestId }, 'bloc call');
    return res;
  }
});
```

When you open a support ticket, include this id — it's the join key.

## Handle rate limits gracefully

The SDK already retries 429s with backoff. If you're seeing `BlocRateLimitError`, your traffic exceeds the bucket in burst even after retries — consider:

- Batching. Many list endpoints take a single call with `page_size: 100` instead of 100 individual reads.
- Backing off on the receiving side rather than retrying tight.
- Asking your operator to raise the per-token multiplier.

## Webhooks as a substitute for polling

If you're polling Bloc for "did anything change?", switch to a webhook. The right shape:

1. Create a webhook subscribed to the events you care about.
2. Verify HMAC on every delivery (see [API › Webhooks](../api/endpoints/webhooks.md)).
3. Dedupe on `event_id` — deliveries are at-least-once.
4. Ack within 5 s with a 2xx. Defer work to a queue if needed.

## Health checks

If your integration is the system of record for some derived state (e.g. mirrors Bloc to a warehouse), expose your own metric:

```
my_integration_last_sync_seconds 12
my_integration_sync_errors_total 0
```

…and alert on `my_integration_last_sync_seconds > 600`. This catches the case where Bloc is fine but your code stopped consuming.

## Cost reporting

If you're hosting Bloc for end users:

- Bill on **workspace storage** (Postgres + S3 bytes per workspace).
- Bill on **AI tokens** (`ai_tokens_in_total + ai_tokens_out_total` per workspace).
- Bill on **webhook deliveries** (`webhook_delivery_attempts_total` per workspace).

All three metrics are available with workspace labels — write a recording rule per workspace and aggregate monthly.
