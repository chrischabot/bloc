# Constants

Exported from `@bloc/sdk/constants` and re-exported at the package root.

| Constant | Value | Purpose |
|---|---|---|
| `DEFAULT_BASE_URL` | `'https://api.notion.com'` | Used when `ClientOptions.baseUrl` is omitted |
| `DEFAULT_TIMEOUT_MS` | `60_000` | Per-request abort |
| `DEFAULT_MAX_RETRIES` | `2` | Retries on 429 / 5xx / network |
| `DEFAULT_INITIAL_RETRY_DELAY_MS` | `1_000` | First retry waits this long |
| `DEFAULT_MAX_RETRY_DELAY_MS` | `60_000` | Backoff cap |
| `MIN_VIEW_COLUMN_WIDTH` | `32` | Minimum column width in pixels — matches `@notionhq/client` |

`LATEST_VERSION` is exported from `@bloc/shared`, not `@bloc/sdk/constants`. It's the default `Notion-Version`.
