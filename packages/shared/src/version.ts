/**
 * The complete list of Notion-Version date stamps this server understands.
 * Add new versions here and update {@link LATEST_VERSION}; never remove a value
 * earlier than the 12-month deprecation window.
 *
 * See `docs/api/05-versioning.md`.
 */
export const SUPPORTED_VERSIONS = ['2022-06-28', '2025-09-03', '2026-03-11', '2026-04-01'] as const;

export type NotionVersion = (typeof SUPPORTED_VERSIONS)[number];

/** Current production baseline. */
export const LATEST_VERSION: NotionVersion = '2026-04-01';

/** Minimum still-supported version. */
export const MIN_SUPPORTED_VERSION: NotionVersion = '2022-06-28';

const VERSION_INDEX: Record<NotionVersion, number> = Object.fromEntries(
  SUPPORTED_VERSIONS.map((v, i) => [v, i]),
) as Record<NotionVersion, number>;

/**
 * Compare two Notion versions. Returns a negative number if `a` is older than
 * `b`, zero if equal, positive if `a` is newer.
 */
export function compareVersions(a: NotionVersion, b: NotionVersion): number {
  return (VERSION_INDEX[a] ?? -1) - (VERSION_INDEX[b] ?? -1);
}

/** Type guard: is the given string a supported Notion-Version? */
export function isSupportedVersion(value: unknown): value is NotionVersion {
  return typeof value === 'string' && (SUPPORTED_VERSIONS as readonly string[]).includes(value);
}

/**
 * Returns true if the requested version is the current baseline.
 * Used by middleware to decide whether to emit `Deprecation` / `Sunset` headers.
 */
export function isCurrentVersion(v: NotionVersion): boolean {
  return v === LATEST_VERSION;
}
