# Writing a webhook receiver

A correct receiver: verifies the signature, dedupes by `event_id`, acks fast, defers work.

## Skeleton (Node + Express)

```ts
import express from 'express';
import crypto from 'node:crypto';

const SIGNING_SECRET = process.env.BLOC_WEBHOOK_SECRET!;

const app = express();
app.post('/hook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sigHeader = String(req.header('x-bloc-signature') ?? '');
  const rawBody   = (req.body as Buffer).toString('utf8');

  if (!verify(SIGNING_SECRET, sigHeader, rawBody)) {
    return res.status(401).send('bad signature');
  }

  const event = JSON.parse(rawBody) as { id: string; type: string; data: unknown };

  if (event.type === 'webhook.verification') {
    return res.status(200).json({ challenge: (event as any).challenge });
  }

  // Dedupe (DB upsert with a unique constraint on event_id is the simplest).
  if (!(await markSeen(event.id))) {
    return res.status(200).end();
  }

  // Ack fast.
  res.status(200).end();

  // Defer work.
  await queue.enqueue('process-webhook', event);
});

function verify(secret: string, header: string, rawBody: string): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const ts = parts['t'];
  const sig = parts['v1'];
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;       // reject replay
  const mac = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig)); }
  catch { return false; }
}
```

## Why each step matters

| Step | Reason |
|---|---|
| Use `express.raw` (not `express.json`) | The HMAC is over the raw bytes; JSON parsing whitespace mutates the signature |
| Verify `Math.abs(now - t) < 5 min` | Prevents replay |
| `timingSafeEqual` | Prevents timing attacks on the comparison |
| Handle `webhook.verification` | Bloc requires this to flip your webhook to `active` |
| Dedupe on `event_id` | Deliveries are at-least-once |
| Return 2xx in < 5 s | Bloc treats timeouts as failures and retries |
| Defer work to a queue | Receivers that do work inline will eventually OOM under bursty load |

## Failure handling

- Returning a 5xx triggers Bloc's retry. Good for transient issues.
- Returning a 4xx that's not 408/429 is treated as a permanent failure — used sparingly. Bloc still retries (the receiver might be misconfigured) but won't backoff exponentially as far.
- After 20 consecutive failures, Bloc disables the webhook (`enabled: false`). Re-enable from the dashboard.

## Listening to multiple workspaces

If your receiver fronts an OAuth app, each workspace has its own signing secret. Store them keyed by `event.workspace_id` and pick the right one at verify time.

```ts
const secret = await db.signingSecrets.get(event.workspace_id);
if (!verify(secret, sigHeader, rawBody)) { ... }
```

## Local development

Use `cloudflared tunnel` or `ngrok` to expose your laptop's `localhost:3000` so Bloc can reach it. Make sure the URL is HTTPS — Bloc refuses HTTP webhook endpoints by default (override with `WEBHOOK_ALLOW_INSECURE=1`, dev only).

## Observability

Emit `webhook_events_received_total{type}` and `webhook_processing_duration_seconds`. Alert on event_loop_lag > 0.5 s when the receiver is busy — it's the canary that you're holding the connection open too long.
