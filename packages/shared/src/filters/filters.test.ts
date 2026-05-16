import { describe, expect, it } from 'vitest';
import { FilterSchema, PropertyFilterSchema, SortArraySchema } from '../index.ts';

describe('filter — property filter', () => {
  it('accepts a title equals filter', () => {
    const result = PropertyFilterSchema.safeParse({
      property: 'Name',
      title: { equals: 'Hello' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a number range filter', () => {
    const result = PropertyFilterSchema.safeParse({
      property: 'Score',
      number: { greater_than: 10 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown operator', () => {
    const result = PropertyFilterSchema.safeParse({
      property: 'Name',
      title: { not_an_op: 'x' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects operand-type mismatch', () => {
    const result = PropertyFilterSchema.safeParse({
      property: 'Score',
      number: { equals: 'not a number' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a date this_week filter', () => {
    const result = PropertyFilterSchema.safeParse({
      property: 'Due',
      date: { this_week: {} },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a checkbox equals filter', () => {
    const result = PropertyFilterSchema.safeParse({
      property: 'Done',
      checkbox: { equals: true },
    });
    expect(result.success).toBe(true);
  });
});

describe('filter — compound', () => {
  it('accepts and-of-two', () => {
    const result = FilterSchema.safeParse({
      and: [
        { property: 'Name', title: { contains: 'a' } },
        { property: 'Score', number: { greater_than: 0 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts depth 2 (or-inside-and)', () => {
    const result = FilterSchema.safeParse({
      and: [
        { property: 'Name', title: { contains: 'a' } },
        {
          or: [
            { property: 'Score', number: { greater_than: 10 } },
            { property: 'Score', number: { less_than: -10 } },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects depth 3 (and-inside-or-inside-and)', () => {
    const result = FilterSchema.safeParse({
      and: [
        {
          or: [
            {
              and: [
                { property: 'a', title: { contains: 'x' } },
                { property: 'b', title: { contains: 'y' } },
              ],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects mixing and+or at the same level', () => {
    const result = FilterSchema.safeParse({
      and: [{ property: 'Name', title: { contains: 'a' } }],
      or: [{ property: 'Name', title: { contains: 'b' } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty and array', () => {
    const result = FilterSchema.safeParse({ and: [] });
    expect(result.success).toBe(false);
  });
});

describe('sort array', () => {
  it('accepts property + direction', () => {
    const result = SortArraySchema.safeParse([{ property: 'Score', direction: 'ascending' }]);
    expect(result.success).toBe(true);
  });

  it('accepts timestamp + direction', () => {
    const result = SortArraySchema.safeParse([
      { timestamp: 'last_edited_time', direction: 'descending' },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects > 8 entries', () => {
    const result = SortArraySchema.safeParse(
      Array.from({ length: 9 }, () => ({ property: 'x', direction: 'ascending' })),
    );
    expect(result.success).toBe(false);
  });

  it('rejects unknown direction', () => {
    const result = SortArraySchema.safeParse([{ property: 'x', direction: 'up' }]);
    expect(result.success).toBe(false);
  });
});
