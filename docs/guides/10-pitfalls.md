# Common pitfalls

Mistakes people make against Bloc and how to avoid them.

## API

- **Forgetting `Notion-Version`.** Returns 400 with `missing_version`. Always send the latest version your SDK pins to.
- **Treating 4xx as transient.** They're not. A 400/403/404 won't fix itself on retry.
- **Polling instead of webhooks.** Wastes rate-limit budget, lags behind reality, drains the search index ahead of you. Use webhooks for change detection.
- **Re-fetching page 1 in a loop** because you forgot to pass `start_cursor`. Common when porting from non-cursor APIs.
- **Not respecting `has_more`.** Trust it; don't try to be clever with `results.length === page_size`.
- **Sending `created_time` / `last_edited_time` on writes.** Server-controlled; passing them is ignored, but it's a smell of misunderstanding the model.

## SDK

- **Holding onto a `Bloc` instance across token rotations.** The instance caches the bearer; create a new one when you refresh.
- **Setting `maxRetries: 0`** because retries "feel wrong" — and then re-implementing retries badly. The default is sensible.
- **Custom `fetch` that doesn't pass the `signal`.** Aborts won't work, and the SDK's timeout becomes advisory.

## Webhooks

- **Verifying after parsing JSON.** The HMAC is over the raw body; whitespace differences invalidate it. Use `express.raw` (or equivalent).
- **Doing slow work synchronously.** Bloc treats > 5 s as a delivery failure. Ack fast, defer.
- **Forgetting to dedupe.** At-least-once means you'll see duplicates eventually.
- **Treating receivers as singletons.** They aren't — Bloc may dispatch the same event concurrently to your retries. Make handlers idempotent on `event_id`.

## Self-hosting

- **Co-locating worker and API on a small node.** Long jobs starve request handlers.
- **No backups.** Or, worse, untested backups. Run a restore drill.
- **Letting `DATABASE_POOL_MAX × replicas` exceed `max_connections`.** Postgres will refuse new connections; the API will return 503.
- **Disabling rate limiting in production.** "Just for one customer" → cascading failure.
- **Skipping the `.env` rename.** Bloc refuses to start in production with the dev session/token secrets.

## Editor / web

- **Caching the web app's HTML at the CDN.** It's personalised; cached HTML serves another user's session.
- **Pinning `@notionhq/client` and Bloc to mismatched versions.** Works thanks to version coercion, but you may see fields the client expects as `undefined`.
- **Embedding inside an iframe without CORS.** The browser's CORS rules apply normally; the API is `CORS_ALLOW_ORIGIN`-gated.

## AI

- **Treating AI quality as a parity target.** It isn't. Choose your provider/model carefully, and benchmark.
- **Running the agent on production data without an audit trail.** Bloc writes an audit row per run, but if you've disabled audit logging, you lose the trace. Don't disable audit.

## Realtime

- **Reusing the WS bearer across users.** Each WS session is tied to one bearer; the server multiplexes via channels, not identity.
- **Buffering ops and sending in bursts.** The server rate-limits per-connection `op` frames; bursts get throttled and may disconnect.

## Performance

- **Querying a database without a filter on small operations.** Always pre-filter; don't fetch the whole DB just to client-side `.find()`.
- **Charting many small databases via `/v1/charts/evaluate` per chart.** Hoist the query, compute charts client-side.
- **Storing huge JSONB properties.** `properties` is GIN-indexed, but each value should stay < 10 KB. Use a `files` property or a child page for anything bigger.

## Migration

- **Trusting the importer 100%.** Import a small workspace first, spot-check by eye, then go big.
- **Not preserving id mappings.** External systems referencing Notion IDs need a translation table; Bloc assigns new UUIDs on import.
