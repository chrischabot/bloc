# Traces

Bloc emits OpenTelemetry spans for HTTP, DB, Redis, MeiliSearch, and outbound HTTP. Configure via env:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317
OTEL_SERVICE_NAME=bloc-api
OTEL_LOG_LEVEL=info
```

`OTEL_SERVICE_NAME` should differ per process: `bloc-api`, `bloc-web`, `bloc-worker`.

## Span shape

Each span carries the standard OTel attributes (`service.name`, `http.method`, `http.target`, `http.status_code`) plus Bloc-specific:

| Attribute | Notes |
|---|---|
| `bloc.request_id` | Matches `X-Request-Id` and the log field |
| `bloc.workspace_id` | Caller's workspace |
| `bloc.user_id` | Caller's user |
| `bloc.route` | Route pattern (`/v1/pages/:page_id`, not `/v1/pages/abc…`) |

Spans use the standard semantic conventions; the Bloc-specific ones are additive.

## Sampling

By default Bloc samples 100% of traces. In production you almost certainly want less:

```
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1     # 10%
```

Always-sample these routes regardless of the global rate, by adding an OTEL config:

```yaml
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 1000 }
      - name: webhook-deliveries
        type: string_attribute
        string_attribute: { key: bloc.route, values: [/v1/webhooks/.*/deliveries] }
      - name: ai
        type: string_attribute
        string_attribute: { key: bloc.route, values: [/v1/ai/.*] }
```

## Browser traces

The web app instruments page loads and SDK calls via the OTel web SDK and ships to the same collector via OTLP HTTP at `/v1/traces`. Disabled by default — set `NEXT_PUBLIC_OTLP_HTTP_ENDPOINT=https://otel.example.com/v1/traces` to enable.

## Joining traces ↔ logs

Both surfaces carry the same `requestId`. In Grafana, the Tempo data source can derive a Loki query from a span: `{service="bloc-api"} | json | requestId="<traceID>"`. Click-through works once you configure the derived field.
