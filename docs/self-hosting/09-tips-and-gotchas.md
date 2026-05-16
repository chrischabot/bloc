# Tips & gotchas

Things that bite people in production. Read once.

## Postgres

- **`max_connections` is the silent killer.** Bloc opens up to `pool_max` per process; with 6 API replicas, 2 workers, and pool_max=20 you need 160 connections plus headroom. Default is 100. Either raise it or front Postgres with pgbouncer.
- **`statement_timeout`** — Bloc sets a per-query timeout (default 30 s). Long exports run on the worker via a dedicated long-job pool with `statement_timeout=0`. Don't override `statement_timeout` globally on the database side; do it per-role if you must.
- **JSONB GIN index size** — the `pages.properties` GIN index can become huge on large workspaces. If you don't filter on most properties, set `BLOC_INDEX_PROPERTIES_BY_NAME` to a comma-list of property names to narrow the index.

## Redis

- **`maxmemory-policy=allkeys-lru`** — make sure this is set. Without it Redis will OOM under load and start refusing writes; Bloc treats writes failing to Redis as fatal for the affected request.
- **AOF off by default** — enable it only if you want to preserve rate-limit state across restarts. Most operators don't.
- **TLS termination** — `rediss://` URIs require the cert chain trust be present in the container. Use a base image with up-to-date CA certs.

## MeiliSearch

- **Don't share an index** between Bloc and another app. Bloc owns the index namespace and will overwrite settings on boot.
- **Disable auto-update** on the Meili server. Bloc pins to a specific minor; if Meili surprises you with a new major, the index settings reset.
- **One node only** — clustering isn't a Meili concept. Plan for snapshot-restore over multi-node HA.

## S3

- **Pre-signed URLs** are issued with a 15-min TTL. If a browser holds onto a URL across a long-running session, large uploads can fail mid-flight. Bloc retries with a fresh URL on 403 — but only twice. Tune `S3_PRESIGN_TTL_SECONDS` up if your network is slow.
- **Bucket region mismatch** — if `S3_REGION` and the actual bucket region differ, you'll get `PermanentRedirect` errors. Either set the right region or set `S3_FORCE_PATH_STYLE=1` (MinIO needs path-style).
- **CORS** on the bucket — the web app uploads directly from the browser. The bucket needs CORS allowing `PUT`, `POST`, `GET` from your `apps/web` origin.

## WebSockets

- **Idle timeout** at the proxy — most LBs default to 60 s. Bloc heartbeats every 30 s; if your LB closes idle connections before then, set the idle timeout to 120 s.
- **`Upgrade` header** — without it the WS upgrade fails silently. Test with `wscat -c wss://your-host/v1/realtime/ws?token=…` before trusting the dashboard.

## TLS & cookies

- Setting `Secure` on cookies but serving over HTTP behind a TLS-terminating proxy breaks login. Either pass `X-Forwarded-Proto: https` through to the API or set `TRUST_PROXY=1`.
- `SameSite=lax` blocks the OAuth redirect callback in some Safari versions. If your OAuth flow is broken on Safari, drop to `SameSite=none` + `Secure=true`.

## Logging

- **Don't log `Authorization`** — Bloc redacts the header before logging but if you wrap it with a custom logger middleware, you might re-introduce it. Audit your pipeline.
- **JSON logs at high RPS** generate a lot of stdout. Make sure your container runtime doesn't block on stdout writes (Docker JSON driver does; configure `max-size` and `max-file`).

## Email

- **DKIM** — set it up properly or your invitation emails will land in spam. Bloc generates the right `From:` header, but the provider needs to sign.
- **Bounce handling** — Bloc doesn't auto-disable invites on bounce. If you care, set up your SES/Postmark inbox to call back into `/v1/admin/email-events` (admin-scoped endpoint, off by default; enable with `EMAIL_FEEDBACK=1`).

## Webhooks

- **Receivers must respond within 5 s** with a 2xx. Slow receivers get retried with exponential backoff and eventually disabled (`failure_streak ≥ 20`).
- **Signature verification** is mandatory. Don't accept unsigned webhooks; that's how someone forges events into your downstream system.

## AI provider

- **Rate limits on the upstream** are your responsibility. Bloc caches `qa` answers per `(workspace, query, index_version)` for 1 h to dampen, but agent runs and bulk autofill can burn through quotas fast.
- **`AI_PROVIDER=stub`** in dev — set this if you want to run the test suite without real keys. The stub returns deterministic answers.

## Worker

- **Don't run too few**. The worker handles search indexing, exports, scheduled automations, reminder firing, email digest, webhook delivery. One worker is *technically* enough; under load, give it at least two.
- **Leader election** uses Redis. If you misconfigure Redis (e.g. wrong DB index), every worker thinks it's leader; harmless but you'll see weird scheduler logs.

## Time zones

- **All timestamps are UTC on the wire.** Don't trust local-time anywhere. The UI converts to the user's TZ for display.
- Reminders and scheduled automations honour the workspace TZ, not the user TZ. Don't be surprised when "9 AM every weekday" fires at 14:00 UTC.

## Notion compatibility

- The official `@notionhq/client` upgrades its expected `Notion-Version` periodically. If you upgrade the client but not Bloc, the SDK may send a version Bloc hasn't seen — Bloc coerces forward, so it still works, but new fields the SDK expects may be `undefined`.
- **Don't** point `@notionhq/client` at Bloc and *also* at `api.notion.com` from the same code path with the same token. They're separate authentication realms.
