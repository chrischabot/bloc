# Reporting & observability

Bloc emits four kinds of signal: **logs**, **metrics**, **traces**, and **analytics events**. This section explains what each one is, how to wire it up, and how to build the dashboards you'll actually use.

1. [Setting up reporting](./01-setting-up.md) — what to deploy, in what order
2. [Logging](./02-logging.md) — structured logs, fields, redaction
3. [Metrics](./03-metrics.md) — every Prometheus metric Bloc emits
4. [Traces](./04-traces.md) — OpenTelemetry wiring, sampling
5. [Rate limiting](./05-rate-limiting.md) — how to monitor, when to alert
6. [Dashboards](./06-dashboards.md) — the recommended dashboard set
7. [Alerts](./07-alerts.md) — what should page you
8. [Analytics & audit](./08-analytics-and-audit.md) — workspace-level reporting for end users
9. [Implementing reporting in your integration](./09-in-your-integration.md) — patterns for instrumenting code that *uses* Bloc
