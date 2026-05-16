import { describe, expect, it } from 'vitest';
import { MAX_KEY_LENGTH, between, generateBetween } from './fractional-index.ts';

describe('fractional-index', () => {
  describe('between', () => {
    it('between(null, null) returns a middle value', () => {
      const k = between(null, null);
      expect(k.length).toBeGreaterThan(0);
      expect(k > '').toBe(true);
    });

    it('between(null, X) returns < X', () => {
      const k = between(null, '5');
      expect(k < '5').toBe(true);
    });

    it('between(X, null) returns > X', () => {
      const k = between('5', null);
      expect(k > '5').toBe(true);
    });

    it('between(a, b) returns a < k < b for distinct adjacent codes', () => {
      const k = between('0', '2');
      expect(k > '0').toBe(true);
      expect(k < '2').toBe(true);
    });

    it('handles same-prefix neighbours by going one level deeper', () => {
      const k = between('a0', 'a1');
      expect(k.startsWith('a0')).toBe(true);
      expect(k > 'a0').toBe(true);
      expect(k < 'a1').toBe(true);
    });

    it('handles long matching prefixes', () => {
      const k = between('aaa', 'aab');
      expect(k.startsWith('aa')).toBe(true);
      expect(k > 'aaa' && k < 'aab').toBe(true);
    });

    it('throws when before >= after', () => {
      expect(() => between('b', 'a')).toThrow(/before >= after/);
      expect(() => between('a', 'a')).toThrow(/before >= after/);
    });

    it('produces strictly increasing keys when inserted between repeatedly', () => {
      const keys: string[] = [between(null, null)];
      for (let i = 0; i < 100; i++) {
        const last = keys[keys.length - 1]!;
        keys.push(between(last, null));
      }
      const sorted = [...keys].sort();
      expect(sorted).toEqual(keys);
    });

    it('stays under MAX_KEY_LENGTH for ordinary append patterns', () => {
      let last: string | null = null;
      for (let i = 0; i < 100; i++) {
        last = between(last, null);
        expect(last.length).toBeLessThanOrEqual(MAX_KEY_LENGTH);
      }
    });
  });

  describe('generateBetween', () => {
    it('returns the requested count in strictly increasing order', () => {
      const keys = generateBetween('A', 'z', 10);
      expect(keys).toHaveLength(10);
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i - 1]! < keys[i]!).toBe(true);
      }
      expect(keys[0]! > 'A').toBe(true);
      expect(keys[keys.length - 1]! < 'z').toBe(true);
    });

    it('handles count=0 and count=1', () => {
      expect(generateBetween('a', 'b', 0)).toEqual([]);
      expect(generateBetween('a', 'b', 1)).toHaveLength(1);
    });
  });
});
