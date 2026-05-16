# Setting up reporting

Recommended starter stack:

| Signal | Tool | Notes |
|---|---|---|
| **Logs** | Loki + Grafana, or any log aggregator | Bloc emits JSON to stdout |
| **Metrics** | Prometheus + Grafana | Scrape `/metrics` on API and worker every 15 s |
| **Traces** | Tempo / Jaeger / Honeycomb / Datadog | Bloc exports via OTLP |
| **Analytics events** | Postgres + your BI tool of choice | Bloc keeps events in the `analytics_events` table |

You can also point all four at a single OpenTelemetry collector and let the collector fan out — that's the topology in `tools/otel/collector-config.yaml`.

## Minimum viable wiring

```bash
# 1. Bring up Prometheus, Grafana, Loki, Tempo.
docker compose -f docker-compose.observability.yml up -d

# 2. Point Bloc at the collector.
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_SERVICE_NAME=bloc-api

# 3. Restart processes.
pnpm dev
```

In Grafana, add data sources:

- Prometheus → `http://prometheus:9090`
- Loki → `http://loki:3100`
- Tempo → `http://tempo:3200`

Import the dashboards from `tools/otel/dashboards/` (see [Dashboards](./06-dashboards.md)).

## Scrape config

Minimal Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: bloc-api
    metrics_path: /metrics
    static_configs:
      - targets: ['api:3001']
  - job_name: bloc-worker
    metrics_path: /metrics
    static_configs:
      - targets: ['worker:3002']
```

Use service discovery instead of static targets in Kubernetes.

## OTel collector

The collector at `tools/otel/collector-config.yaml` is configured to:

- Receive OTLP gRPC at `:4317` and OTLP HTTP at `:4318`.
- Export traces to Tempo.
- Export logs to Loki.
- Export metrics to Prometheus (remote write).

In production, replace the export targets with your own.

## What to enable, what to skip

| Signal | Always enable | Skip in low-traffic dev |
|---|---|---|
| Logs | yes | — |
| Metrics | yes | — |
| Traces | yes (sample 5–10%) | full-rate sampling unless debugging |
| Beacons → DB | yes | per-user UI action breakdown if you don't use it |

The next pages drill into each signal.
