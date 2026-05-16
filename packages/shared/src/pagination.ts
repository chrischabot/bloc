import { z } from 'zod';

/** Standard list envelope. */
export interface ListResponse<T, K extends string = string> {
  object: 'list';
  type: K;
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export const PaginationQuerySchema = z.object({
  start_cursor: z.string().optional(),
  page_size: z.coerce
    .number()
    .int()
    .min(1, 'page_size must be at least 1')
    .max(100, 'page_size must be at most 100')
    .default(100),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

const CURSOR_VERSION = 1 as const;

/** Encode an opaque cursor payload as base64url. */
export function encodeCursor<T>(payload: T): string {
  const blob = JSON.stringify({ v: CURSOR_VERSION, k: payload });
  return Buffer.from(blob, 'utf8').toString('base64url');
}

/** Decode an opaque cursor; throws if malformed or unknown version. */
export function decodeCursor<T>(cursor: string): T {
  const json = Buffer.from(cursor, 'base64url').toString('utf8');
  const parsed = JSON.parse(json) as { v: number; k: T };
  if (parsed.v !== CURSOR_VERSION) {
    throw new Error(`Unsupported cursor version: ${parsed.v}`);
  }
  return parsed.k;
}
