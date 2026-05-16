/** Default base URL for the Notion API. */
export const DEFAULT_BASE_URL = 'https://api.notion.com';

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** Maximum retries per request. */
export const DEFAULT_MAX_RETRIES = 2;

/** Initial retry delay in milliseconds (exponential backoff with jitter from here). */
export const DEFAULT_INITIAL_RETRY_DELAY_MS = 1_000;

/** Cap on the per-retry delay in milliseconds. */
export const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;

/** Minimum view-column width in pixels (matches @notionhq/client). */
export const MIN_VIEW_COLUMN_WIDTH = 32;
