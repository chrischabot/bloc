# Analytics

Endpoints under `/v1/analytics`. Provides client-side beacons and workspace-level summaries.

## Beacon (client)

`POST /v1/analytics/beacon`

Used by the web app to record page views, web vitals, and UI actions. Has its own (more generous) rate-limit bucket.

```json
{
  "kind":   "page_view" | "web_vital" | "ui_action",
  "page_id": "uuid",
  "metric":  "LCP" | "INP" | "CLS" | "TTFB" | "FCP",
  "value":   1234,
  "action":  "block.created.paragraph",
  "ts":      1715900000000
}
```

Returns `204 No Content`. Designed to be fire-and-forget; failures are not surfaced to the user.

## Summary

`GET /v1/analytics/summary`

Workspace-scoped aggregate. Admin only.

```json
{
  "object": "analytics_summary",
  "workspace_id": "uuid",
  "total_events": 142523,
  "page_views":   53210,
  "web_vitals": {
    "LCP": { "count": 12011, "p50": 1.8, "p95": 3.2 },
    "INP": { "count": 11900, "p50": 92,  "p95": 240 }
  },
  "ui_actions": { "block.created.paragraph": 5311, "search.opened": 421 }
}
```

## Events

`GET /v1/analytics/events?kind=page_view&page_size=100`

Returns the raw beacon stream. Useful for ad-hoc analysis; for production analytics, ship the beacon to your own pipeline via a webhook.

## Reporting

See [Reporting](../../reporting/README.md) for end-to-end recommendations on dashboards, alerts, and audit reports.
