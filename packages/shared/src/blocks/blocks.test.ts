import { describe, expect, it } from 'vitest';
import {
  AnyBlockInputSchema,
  BLOCK_PAYLOADS,
  BLOCK_TYPES,
  BlockInputSchema,
  deriveBlockPlainText,
  isBlockType,
} from './index.ts';

describe('blocks catalogue', () => {
  it('exposes 38 block types', () => {
    expect(BLOCK_TYPES).toHaveLength(38);
  });

  it('every type has a payload schema entry', () => {
    for (const t of BLOCK_TYPES) {
      expect(BLOCK_PAYLOADS[t]).toBeDefined();
    }
  });

  it('isBlockType narrows correctly', () => {
    expect(isBlockType('paragraph')).toBe(true);
    expect(isBlockType('not_a_block')).toBe(false);
  });
});

describe('paragraph block', () => {
  it('accepts a valid paragraph input', () => {
    const result = AnyBlockInputSchema.safeParse({
      type: 'paragraph',
      paragraph: { rich_text: [], color: 'default' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a paragraph missing rich_text', () => {
    const result = AnyBlockInputSchema.safeParse({ type: 'paragraph', paragraph: {} });
    expect(result.success).toBe(false);
  });

  it('rejects unknown color', () => {
    const result = AnyBlockInputSchema.safeParse({
      type: 'paragraph',
      paragraph: { rich_text: [], color: 'magenta' },
    });
    expect(result.success).toBe(false);
  });
});

describe('to_do block', () => {
  it('accepts checked false default', () => {
    const result = AnyBlockInputSchema.safeParse({
      type: 'to_do',
      to_do: { rich_text: [{ type: 'text', text: { content: 'Buy milk', link: null } }] },
    });
    expect(result.success).toBe(true);
  });
});

describe('code block', () => {
  it('requires language string', () => {
    const result = AnyBlockInputSchema.safeParse({
      type: 'code',
      code: { rich_text: [], caption: [], language: 'typescript' },
    });
    expect(result.success).toBe(true);
  });
});

describe('table + table_row', () => {
  it('table requires table_width', () => {
    const ok = BlockInputSchema('table').safeParse({
      type: 'table',
      table: { table_width: 3 },
    });
    expect(ok.success).toBe(true);
    const bad = BlockInputSchema('table').safeParse({ type: 'table', table: {} });
    expect(bad.success).toBe(false);
  });

  it('table_row carries cells as rich-text arrays', () => {
    const result = BlockInputSchema('table_row').safeParse({
      type: 'table_row',
      table_row: { cells: [[{ type: 'text', text: { content: 'A', link: null } }], []] },
    });
    expect(result.success).toBe(true);
  });
});

describe('equation', () => {
  it('requires non-empty expression', () => {
    const ok = BlockInputSchema('equation').safeParse({
      type: 'equation',
      equation: { expression: 'E = mc^2' },
    });
    expect(ok.success).toBe(true);
    const bad = BlockInputSchema('equation').safeParse({
      type: 'equation',
      equation: { expression: '' },
    });
    expect(bad.success).toBe(false);
  });
});

describe('callout icon', () => {
  it('accepts emoji icon', () => {
    const result = BlockInputSchema('callout').safeParse({
      type: 'callout',
      callout: {
        rich_text: [],
        icon: { type: 'emoji', emoji: '💡' },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('image (external)', () => {
  it('accepts external URL', () => {
    const result = BlockInputSchema('image').safeParse({
      type: 'image',
      image: { type: 'external', external: { url: 'https://example.com/a.png' } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-http external URL', () => {
    const result = BlockInputSchema('image').safeParse({
      type: 'image',
      image: { type: 'external', external: { url: 'javascript:alert(1)' } },
    });
    expect(result.success).toBe(false);
  });
});

describe('deriveBlockPlainText', () => {
  it('joins rich_text content for text-bearing blocks', () => {
    const text = deriveBlockPlainText('paragraph', {
      rich_text: [
        {
          type: 'text',
          text: { content: 'Hello ', link: null },
          annotations: {},
          plain_text: 'Hello ',
          href: null,
        },
        {
          type: 'text',
          text: { content: 'world', link: null },
          annotations: {},
          plain_text: 'world',
          href: null,
        },
      ],
      color: 'default',
    });
    expect(text).toBe('Hello world');
  });

  it('returns equation expression', () => {
    const text = deriveBlockPlainText('equation', { expression: 'a^2 + b^2 = c^2' });
    expect(text).toBe('a^2 + b^2 = c^2');
  });

  it('returns empty for non-text blocks', () => {
    expect(deriveBlockPlainText('divider', {})).toBe('');
  });
});
