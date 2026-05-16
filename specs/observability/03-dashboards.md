# Dashboards

Dashboards are versioned as JSON under `tools/grafana/dashboards/`. Loaded by the Grafana provisioning sidecar in `docker-compose.yml`.

## Required dashboards

| Dashboard | Panels |
|-----------|--------|
| **Latency Overview** | API p50/p95/p99 by route, error rate, inflight requests |
| **Per-Endpoint** | One row per endpoint with latency histogram, error rate, throughput |
| **Realtime** | WS connections, message rate in/out, awareness churn, sync rejection rate |
| **Database Engine** | Query duration histogram, query types, formula/rollup eval count, slow queries |
| **Search** | Index lag, index writes/s, search QPS, hit rate |
| **Errors** | Top error codes, top error routes, recent 5xx samples |
| **Saturation** | DB pool, Redis, CPU, memory, event-loop lag |
| **Frontend Web Vitals** | LCP/INP/CLS distributions, top slow interactions |
| **Audit & Auth** | Sign-ins, rate-limit hits, permission denials, token revocations |

## Conventions

- Time range: defaults to last 1h.
- Theme: dark to match Grafana default.
- Each panel has a description with the metric and intended threshold.
- Each dashboard has a "Runbook" link in the description pointing to a runbook in `docs/observability/runbooks/` (created on incident).

## Provisioning

`tools/grafana/provisioning/` includes:

- `datasources/`: Tempo (traces), Loki (logs), Prometheus (metrics).
- `dashboards/`: dashboard provider config.