import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('chaos harness', () => {
  it('property tests are wired (string round-trip)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => {
        const round = JSON.parse(JSON.stringify(s));
        expect(round).toBe(s);
      }),
      { numRuns: 50 },
    );
  });
});
