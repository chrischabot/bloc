# Bloc Documentation

Welcome. Bloc is an open-source, self-hostable workspace that's wire-compatible with the public Notion API. This directory is the **user- and developer-facing documentation**. For the original build specification suite (north-star plan, per-phase deliverables, pixel-perfect checklists), see [`../specs/`](../specs/).

## Where to start

| If you are... | Read |
|---|---|
| A new user trying Bloc for the first time | [Platform overview](./platform/01-overview.md), then [Quickstart](./guides/01-quickstart.md) |
| Self-hosting Bloc | [Self-hosting guide](./self-hosting/01-getting-started.md) |
| Building against the REST API | [API reference](./api/README.md) |
| Using the TypeScript SDK | [SDK reference](./sdk/README.md) |
| Setting up reporting / observability | [Reporting](./reporting/README.md) |
| Using the web app day-to-day | [Web dashboard](./web/README.md) |

## Sections

### [Platform](./platform/README.md)
What Bloc is, the data model, the surfaces it exposes, how it relates to Notion.

### [Self-hosting](./self-hosting/README.md)
End-to-end operator guide: dependencies, environment variables, database migrations, scaling, backups, upgrades.

### [REST API reference](./api/README.md)
Every endpoint at `/v1/*` and `/api/v3/*` — request shape, response shape, errors, examples.

### [SDK reference](./sdk/README.md)
The first-party `@bloc/sdk` package — every namespace, function, parameter, and type.

### [Reporting & observability](./reporting/README.md)
Analytics beacons, audit log, version history, Prometheus metrics, OpenTelemetry traces, dashboards.

### [Web dashboard](./web/README.md)
The Next.js app at `apps/web` — pages, blocks, databases, sharing, settings, AI surfaces.

### [Apps & integrations](./apps/README.md)
Surface-specific guides: editor, databases, automations, forms, calendar, mail, sites publishing, AI agent.

### [Guides](./guides/README.md)
Task-oriented how-tos: quickstart, importing from Notion, writing an integration, building a custom block, deploying to production.

## Conventions

- Code blocks are TypeScript unless labelled otherwise.
- `BLOC_TOKEN` is the bearer token used in every authenticated request. In a fresh dev environment the bootstrap flow prints one on first web load.
- API examples assume `http://localhost:3001` (the API listen address from [`docker-compose.yml`](../docker-compose.yml)). In production substitute your own base URL.
- The public REST surface lives at `/v1/*` and is documented to be **wire-compatible** with `api.notion.com/v1`. The internal `/api/v3/*` surface is documented as **behaviourally** compatible — it's intended for the `<NotionRenderer/>` from `react-notion-x` and is not a stable public contract.

## License

Apache License 2.0 — see [LICENSE](../LICENSE).
