/**
 * Fractional indexing: generate lexicographic keys so that any two siblings
 * always have a string strictly between them.
 *
 * Implementation note: we use a 62-character alphabet `[0-9A-Za-z]`. Keys are
 * compared as plain strings; "between" means any value `a < x < b`.
 *
 * See `docs/architecture/03-data-model.md#fractional-indexing`.
 */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length;
/** Lowest character (`'0'`). */
const FIRST = ALPHABET.charAt(0);
/** Highest character (`'z'`). */
const LAST = ALPHABET.charAt(BASE - 1);
/** Maximum key length before re-balance is recommended. */
export const MAX_KEY_LENGTH = 50;

const RANK: Record<string, number> = Object.fromEntries(ALPHABET.split('').map((c, i) => [c, i]));

function charAtOr(key: string, index: number, fallback: string): string {
  return index < key.length ? key.charAt(index) : fallback;
}

function rankOf(ch: string): number {
  const r = RANK[ch];
  if (r === undefined) throw new Error(`Invalid fractional-index character: ${JSON.stringify(ch)}`);
  return r;
}

function midpointChar(a: string, b: string): string | null {
  const ra = rankOf(a);
  const rb = rankOf(b);
  if (rb - ra < 2) return null;
  const mid = ALPHABET.charAt(Math.floor((ra + rb) / 2));
  return mid.length === 1 ? mid : null;
}

/**
 * Generate a key strictly between `before` and `after`.
 * `before` or `after` may be `null` to mean "no lower bound" or "no upper bound".
 *
 * Examples:
 *   between(null, null)   → 'V'   (middle)
 *   between(null, '5')    → '2'
 *   between('a0', 'a1')   → 'a0V' (one level deeper)
 *   between('a', 'b')     → 'aV'
 */
export function between(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) {
    throw new Error(`fractional-index: before >= after (${before} >= ${after})`);
  }

  const a = before ?? '';
  const b = after ?? '';

  let out = '';
  let i = 0;

  while (true) {
    const ca = charAtOr(a, i, FIRST);
    const cb = i < b.length ? b.charAt(i) : LAST;

    if (ca === cb) {
      out += ca;
      i += 1;
      continue;
    }

    const mid = midpointChar(ca, cb);
    if (mid !== null) {
      out += mid;
      return out;
    }

    // No midpoint between ca and cb at this position. Append ca and recurse one
    // level deeper, looking for any value greater than the suffix of `a`.
    out += ca;
    i += 1;

    while (true) {
      const next = charAtOr(a, i, FIRST);
      if (next === LAST) {
        out += next;
        i += 1;
        continue;
      }
      // Pick a character strictly greater than `next` and less than LAST.
      const r = rankOf(next);
      const candidate = ALPHABET.charAt(Math.floor((r + BASE) / 2));
      if (candidate.length !== 1) {
        out += next;
        i += 1;
        continue;
      }
      out += candidate;
      return out;
    }
  }
}

/**
 * Convenience: generate a sequence of `count` keys spanning the interval
 * (before, after). Useful when bulk-inserting children in a single transaction.
 */
export function generateBetween(
  before: string | null,
  after: string | null,
  count: number,
): string[] {
  if (count <= 0) return [];
  if (count === 1) return [between(before, after)];

  // Divide-and-conquer: pick the midpoint, then recurse on each half.
  const mid = between(before, after);
  const left = generateBetween(before, mid, Math.floor((count - 1) / 2));
  const right = generateBetween(mid, after, Math.ceil((count - 1) / 2));
  return [...left, mid, ...right];
}
