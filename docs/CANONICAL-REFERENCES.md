# Canonical References

When implementing or verifying any feature, the agent **must** consult primary sources, not its prior knowledge. This document is the agent's authoritative map of where to look — ranked by authority.

When in doubt, fetch. When in conflict, the higher-ranked source wins.

---

## Authority hierarchy

```
1. Notion engineering blog            (architecture truth)
2. developers.notion.com/reference    (public API contract)
3. @notionhq/client source            (public SDK contract)
4. notion.com/help                    (product behaviour)
5. Reverse-engineering libraries      (internal v3 API)
6. UI screenshot corpus               (visual reference)
7. Third-party tech-stack write-ups   (inferential only)
```

A claim only present below #5 (without corroboration from #1–#4) is **inferential** and should be marked as such in any spec doc that depends on it.

---

## 1. Notion engineering blog — architecture truth

The single most authoritative source on how Notion's backend actually works.

| URL | Topic | Mirrors into |
|-----|-------|--------------|
| `https://www.notion.com/blog/data-model-behind-notion` | "Everything is a block" — the foundational data model | `docs/architecture/03-data-model.md`, `docs/api/schemas/block-types.md#canonical-block-model` |
| `https://www.notion.com/blog/sharding-postgres-at-notion` | 32 × 15 = 480-logical-shard layout; double-write / dark-read migration | `docs/architecture/04-storage-strategy.md#sharding-strategy` |
| `https://www.notion.com/blog/building-and-scaling-notions-data-lake` | Hudi-on-S3, 4-hour cadence, Snowflake retirement | `docs/architecture/04-storage-strategy.md#data-lake` |
| `https://www.notion.com/blog/how-we-made-notion-available-offline` | Per-device SQLite, offline forest, sync queues | `docs/architecture/05-realtime-architecture.md#offline-mode` |
| `https://www.notion.com/blog/introducing-notion-calendar` | Notion Calendar product framing | `docs/frontend/31-calendar-app.md` |
| `https://www.notion.com/blog/how-notion-uses-custom-agents` | Custom-agent deployment patterns | `docs/frontend/18-ai.md#agent` |

When any blog post updates, the corresponding spec doc must be reviewed in the same change-set.

---

## 2. `developers.notion.com/reference` — public API contract

The byte-equivalence target for `apps/api/src/routes/**`.

| Path | Topic |
|------|-------|
| `/reference/intro` | Authentication, versioning, request limits, status codes, pagination |
| `/reference/versioning` | The `Notion-Version` header date stamps |
| `/reference/request-limits` | Rate limits, headers (`X-RateLimit-*`) |
| `/reference/block` | Every block type |
| `/reference/page` | Page object |
| `/reference/database` | Database object |
| `/reference/data-source` | Data source object (2025-09-03+) |
| `/reference/view` | View / data-source-view object |
| `/reference/comment` | Comment object |
| `/reference/file` | File object |
| `/reference/user` | User object |
| `/reference/parent` | Parent reference |
| `/reference/webhooks` | Webhook subscription model + event catalogue |
| `/reference/post-search` | Workspace search |
| `/reference/post-database-query` | Database / data-source query (filter, sort, pagination) |
| `/changelog` | Every public-API change, dated |
| `/llms.txt` | Machine-readable index of the entire reference (use this to seed crawls) |

**Conformance test:** `@notionhq/client` (latest) works unmodified against our server.

---

## 3. `@notionhq/client` source — public SDK contract

| URL | Notes |
|-----|-------|
| `https://github.com/makenotion/notion-sdk-js` | Official TS/JS SDK |
| `https://github.com/makenotion/notion-sdk-py` | Official Python SDK |
| `https://github.com/ramnes/notion-sdk-py` | Widely-used async community Python SDK (httpx + pydantic) |
| `https://github.com/makenotion/notion-cookbook` | Example projects |

The SDK source is **generated** from the API specification (`src/api-endpoints.ts`); direct edits are overwritten on release. Our `tools/codegen/sdk-types.ts` mirrors that codegen pipeline against `packages/shared`.

Default constants (must match exactly — see `docs/api/06-sdk.md#default-constants`):

```
DEFAULT_BASE_URL = "https://api.notion.com"
DEFAULT_TIMEOUT_MS = 60_000
DEFAULT_MAX_RETRIES = 2
DEFAULT_INITIAL_RETRY_DELAY_MS = 1_000
DEFAULT_MAX_RETRY_DELAY_MS = 60_000
MIN_VIEW_COLUMN_WIDTH = 32
```

---

## 4. `notion.com/help` — product behaviour

The exhaustive product surface inventory.

| URL prefix | Topic |
|-----------|-------|
| `/help` | Help Center root; crawl exhaustively |
| `/help/intro-to-databases` | Database fundamentals |
| `/help/database-properties` | Every property type |
| `/help/data-sources-and-linked-databases` | Data-sources primitive |
| `/help/views-filters-and-sorts` | View types, filter grammar, sort logic |
| `/help/intro-to-teamspaces` | Teamspaces and access control |
| `/help/sharing-and-permissions` | Sharing model and permission tiers |
| `/help/whos-who-in-a-workspace` | Workspace roles |
| `/help/add-members-admins-guests-and-groups` | Member / guest lifecycle |
| `/help/autofill` | AI Autofill |
| `/help/notion-ai-connectors` | Connectors and Turbopuffer-backed embeddings |
| `/help/notion-sites` | Publishing |
| `/help/notion-forms` | Forms |
| `/help/guides/using-slash-commands` | Slash command grammar |
| `/help/keyboard-shortcuts` | Authoritative shortcut list |
| `/help/notion-calendar-keyboard-shortcuts` | Calendar shortcuts |
| `/help/notion-mail-keyboard-shortcuts` | Mail shortcuts |

---

## 5. Reverse-engineering libraries — internal v3 API

Notion does not document the v3 surface. These libraries are the **closest public approximation** and the primary input for `docs/architecture/09-internal-v3-api.md`.

| URL | Language | What it maps |
|-----|----------|--------------|
| `https://github.com/jamalex/notion-py` | Python | Endpoint catalogue, `RecordStore`, push-update model. Primary technical reference. |
| `https://github.com/kjk/notionapi` | Go | Complementary endpoint coverage |
| `https://github.com/NotionX/react-notion-x` | TS/React | `recordMap` shape consumer; `packages/notion-compat/readme.md` is the canonical block-by-block compat ledger against the public API |
| `https://github.com/splitbee/react-notion` | TS/React | Earlier, minimal `blockMap` renderer |

**Conformance test:** `<NotionRenderer/>` from `react-notion-x` over our `recordMap` matches a captured reference render < 1% pixel diff.

These libraries lag the live product. Treat behavioural divergence between them and a live capture as **the live capture wins** and update the v3 spec accordingly.

---

## 6. UI screenshot corpus — visual reference

The pixel-perfect target's only source of truth. See `docs/testing/07-visual-regression.md#reference-set`.

| Source | How to use |
|--------|-----------|
| `https://www.notion.so/<public-page>` | Open in `Browser Operator`; capture at fixed viewports |
| `https://www.notion.com/blog` | High-quality embedded screenshots of every feature launch |
| `https://www.notion.com/customers` | Production screenshots in context |
| `https://mobbin.com` (search "Notion") | Web + mobile flows, onboarding, AI surfaces |
| `https://www.notion.com/press` | Press kit + logos |

All screenshots fall under the policy in `reference/screenshots/LICENSE-NOTE.md`: internal visual comparison only.

---

## 7. Inferential / third-party sources

Useful for sanity-checking but **never authoritative on their own**.

| URL | Notes |
|-----|-------|
| `https://labs.relbis.com/blog/2024-04-18_notion_backend/` | Third-party backend synthesis |
| `https://www.educative.io/blog/notion-system-design` | OT vs CRDT trade-offs |
| `https://wildwildtech.substack.com/p/how-notion-stores-the-data-and-scale` | Sharding write-up referencing the official Notion blog |
| `https://howworks.ai/blog/how-notion-was-built` | Block-model distillation |
| `https://slashdev.io/-breaking-down-notions-tech-stack` | Stack claims; cross-reference with #1 before relying on any |
| `https://brandfetch.com/notion.so` | Quick palette / wordmark extraction; verify against the live product |

---

## How the agent should use this hierarchy

For any feature being implemented:

1. **Open the matching #1 (engineering blog) URL** if architecture is at stake. Capture screenshots into `reference/screenshots/PHASE-XX/`. Reconcile with the relevant `docs/architecture/*` doc.
2. **Open the matching #2 (developers.notion.com) URL** for every public endpoint touched. Reconcile with `docs/api/endpoints/*` and `docs/api/schemas/*`.
3. **Read the matching #3 SDK function** in `@notionhq/client` source. Reconcile with `packages/sdk` and `docs/api/06-sdk.md`.
4. **Open the matching #4 (help) URL** for every UI surface. Reconcile with `docs/frontend/*`.
5. **If touching internal v3 behaviour**, cross-reference against `notion-py`, `notionapi`, and `react-notion-x`. Run the conformance harness in `tests/v3-parity/`.
6. **For pixel verification**, capture from `https://www.notion.so/<page>` via `Browser Operator` against the same viewport our tests use.
7. **Inferential sources are last** — corroborate only.

If a divergence is found, update the spec in the same change-set as the implementation, and note the divergence in `docs/CHANGELOG.md`.

---

## Maintenance

This document is updated:

- When a Notion engineering blog post is published or substantially revised.
- When a new Notion-Version date ships (the matrix in `docs/api/05-versioning.md` is the authoritative pin; this doc cross-links to it).
- When a new reverse-engineering library matures or supersedes an existing one.
- When the screenshot corpus's reference URLs change.

Reviewed at every release-candidate phase boundary.