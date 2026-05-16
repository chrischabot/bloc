import { describe, expect, it } from 'vitest';
import { PaginationQuerySchema, decodeCursor, encodeCursor } from './pagination.ts';

describe('pagination', () => {
  describe('cursor codec', () => {
    it('round-trips a payload', () => {
      const payload = { position: 'a0', id: '11111111-1111-1111-1111-111111111111' };
      const encoded = encodeCursor(payload);
      const decoded = decodeCursor<typeof payload>(encoded);
      expect(decoded).toEqual(payload);
    });

    it('rejects an unknown version', () => {
      const bad = Buffer.from(JSON.stringify({ v: 9999, k: {} })).toString('base64url');
      expect(() => decodeCursor(bad)).toThrow(/Unsupported cursor version/);
    });
  });

  describe('PaginationQuerySchema', () => {
    it('defaults page_size to 100', () => {
      const parsed = PaginationQuerySchema.parse({});
      expect(parsed.page_size).toBe(100);
    });

    it('rejects page_size > 100', () => {
      const result = PaginationQuerySchema.safeParse({ page_size: 101 });
      expect(result.success).toBe(false);
    });

    it('rejects page_size < 1', () => {
      const result = PaginationQuerySchema.safeParse({ page_size: 0 });
      expect(result.success).toBe(false);
    });

    it('accepts page_size as a string number', () => {
      const parsed = PaginationQuerySchema.parse({ page_size: '50' });
      expect(parsed.page_size).toBe(50);
    });
  });
});
