import { describe, expect, it } from 'vitest';
import {
  AnnotationsSchema,
  RichTextArraySchema,
  RichTextSchema,
  deriveHref,
  derivePlainText,
} from './rich-text.ts';

describe('rich-text', () => {
  it('parses a text node with default annotations', () => {
    const parsed = RichTextSchema.parse({
      type: 'text',
      text: { content: 'Hello', link: null },
    });
    expect(parsed.annotations.bold).toBe(false);
    expect(parsed.plain_text).toBe('');
  });

  it('parses a mention node (user)', () => {
    const parsed = RichTextSchema.parse({
      type: 'mention',
      mention: { type: 'user', user: { id: '11111111-1111-1111-1111-111111111111' } },
    });
    expect(parsed.type).toBe('mention');
  });

  it('parses an equation node', () => {
    const parsed = RichTextSchema.parse({
      type: 'equation',
      equation: { expression: 'E = mc^2' },
    });
    if (parsed.type !== 'equation') throw new Error('expected equation');
    expect(parsed.equation.expression).toBe('E = mc^2');
  });

  it('rejects unknown annotation colors', () => {
    const result = AnnotationsSchema.safeParse({ color: 'magenta' });
    expect(result.success).toBe(false);
  });

  it('caps the array at 100 nodes', () => {
    const nodes = Array.from({ length: 101 }, () => ({
      type: 'text' as const,
      text: { content: 'x', link: null },
    }));
    const result = RichTextArraySchema.safeParse(nodes);
    expect(result.success).toBe(false);
  });

  it('caps content at 2000 characters', () => {
    const result = RichTextSchema.safeParse({
      type: 'text',
      text: { content: 'a'.repeat(2001), link: null },
    });
    expect(result.success).toBe(false);
  });

  it('derives plain_text from text content', () => {
    const node = RichTextSchema.parse({
      type: 'text',
      text: { content: 'Hello world', link: null },
    });
    expect(derivePlainText(node)).toBe('Hello world');
  });

  it('derives href from text link', () => {
    const node = RichTextSchema.parse({
      type: 'text',
      text: { content: 'click', link: { url: 'https://example.com' } },
    });
    expect(deriveHref(node)).toBe('https://example.com');
  });

  it('derives href as null when no link', () => {
    const node = RichTextSchema.parse({
      type: 'text',
      text: { content: 'plain', link: null },
    });
    expect(deriveHref(node)).toBeNull();
  });
});
