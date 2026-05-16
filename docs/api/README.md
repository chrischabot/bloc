# REST API reference

Bloc exposes a public REST API at `/v1/*` (wire-compatible with `api.notion.com/v1`) and an internal recordMap API at `/api/v3/*`.

## Sections

### Conventions
1. [Overview & conventions](./01-overview.md) — base URL, JSON, identifiers
2. [Authentication](./02-authentication.md) — bearer tokens, scopes, OAuth
3. [Errors](./03-errors.md) — envelope, code catalogue, status mapping
4. [Pagination](./04-pagination.md) — `start_cursor` + `has_more`
5. [Rate limiting](./05-rate-limiting.md) — budgets, 429 handling
6. [Versioning](./06-versioning.md) — the `Notion-Version` header

### Resources
7. [Pages](./endpoints/pages.md)
8. [Blocks](./endpoints/blocks.md)
9. [Databases](./endpoints/databases.md)
10. [Data sources](./endpoints/data-sources.md)
11. [Users](./endpoints/users.md)
12. [Comments](./endpoints/comments.md)
13. [Search](./endpoints/search.md)
14. [Webhooks](./endpoints/webhooks.md)
15. [AI](./endpoints/ai.md)
16. [Automations & buttons](./endpoints/automations.md)
17. [Charts](./endpoints/charts.md)
18. [Forms](./endpoints/forms.md)
19. [Reminders](./endpoints/reminders.md)
20. [Inbox](./endpoints/inbox.md)
21. [Versions](./endpoints/versions.md)
22. [Permissions](./endpoints/permissions.md)
23. [Analytics](./endpoints/analytics.md)
24. [Sites publishing](./endpoints/sites.md)
25. [Internal v3](./endpoints/internal-v3.md)

### Schemas
- [Block types](./schemas/block-types.md)
- [Property types](./schemas/property-types.md)
- [Filters](./schemas/filters.md)
- [Sorts](./schemas/sorts.md)
- [Rich text](./schemas/rich-text.md)
- [Formulas](./schemas/formulas.md)

## Quick start

```bash
# Health check
curl http://localhost:3001/health

# Authenticated request
curl -H "Authorization: Bearer $BLOC_TOKEN" \
     -H "Notion-Version: 2025-09-03" \
     http://localhost:3001/v1/users/me
```

The full surface is also documented by the [SDK reference](../sdk/README.md), which is generated from the same types.
