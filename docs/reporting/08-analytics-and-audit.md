# Analytics & audit

The operator-facing observability covered in this section so far is for *running Bloc*. This page is about reporting **inside** a Bloc workspace — what end users and admins can see.

## Workspace analytics

Backed by the `analytics_events` table and exposed through `/v1/analytics`:

- `POST /v1/analytics/beacon` — the web app fires page views, web vitals, and UI actions.
- `GET /v1/analytics/summary` — workspace-scoped aggregate (admin).
- `GET /v1/analytics/events` — raw beacon stream (admin).

### What gets recorded

| `kind` | What | Fields |
|---|---|---|
| `page_view` | A user opened a page | `page_id`, `user_id`, `ts` |
| `web_vital` | A Core Web Vital measurement from the browser | `metric` (LCP, INP, CLS, TTFB, FCP), `value`, `page_id` |
| `ui_action` | Any UI action the app instruments (block created, search opened, …) | `action`, `page_id?`, `user_id` |

PII is restricted to the user id (never name or email) and the workspace id. Cookies are not recorded.

### Disabling

Set `ANALYTICS_DISABLE=1` on the API. Beacons return 204 but no row is written. The admin summary then returns zeroed counters.

## Audit log

A separate stream: every state-changing API call writes a row to `audit_events`.

`GET /v1/workspaces/me/audit?action=<glob>&actor_user_id=<id>&since=<ts>&page_size=50`

Response:

```json
{
  "object": "list",
  "type": "audit_event",
  "results": [
    {
      "object": "audit_event",
      "id": "uuid",
      "ts": "...",
      "action": "page.created" | "page.updated" | "page.permissions.granted" | "integration.created" | "automation.ran" | ...,
      "actor": { "type": "user" | "bot", "id": "uuid" },
      "target": { "type": "page" | "block" | "database" | "automation" | "webhook", "id": "uuid" },
      "metadata": { ... }
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

### Retention

Audit events are retained per workspace plan setting (default: 180 days). Beyond retention they are coalesced into daily summaries.

### Compliance

The audit log is append-only at the SQL level (`audit_events` has no `UPDATE`/`DELETE` grant for the application role). For SOC 2 / ISO 27001 evidence, periodically dump the table to an immutable store.

## Reporting recipes

### "What did Alice do last Tuesday?"

```
GET /v1/workspaces/me/audit?actor_user_id=<alice>&since=2025-05-13T00:00:00Z&page_size=100
```

### "Who modified this page in the last 7 days?"

Combine page versions and audit:

```ts
const versions = await bloc.versions.list({ page_id, page_size: 50 });
// versions contains the clock + created_at; the audit log has the actor.
const audit = await fetch(`/v1/workspaces/me/audit?target_id=${page_id}&since=...`);
```

### "Workspace-wide weekly health"

Pull `analytics.summary()` daily, store the result somewhere queryable. The summary endpoint is cheap (single SQL aggregate), so a daily snapshot is fine.

## Surfacing in the dashboard

The web app's **Insights** panel under workspace settings renders the summary, with sparklines per metric. The same data is available to end users (read-scope) and admins (all).
