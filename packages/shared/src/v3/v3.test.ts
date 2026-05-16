import { describe, expect, it } from 'vitest';
import type { RichText } from '../rich-text.ts';
import { richTextToV3, v3ToRichText } from './inline.ts';

describe('v3 inline codec', () => {
  it('round-trips plain text', () => {
    const nodes: RichText[] = [
      {
        type: 'text',
        text: { content: 'Hello world', link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default',
        },
        plain_text: 'Hello world',
        href: null,
      },
    ];
    const v3 = richTextToV3(nodes);
    expect(v3).toEqual([['Hello world']]);
    const back = v3ToRichText(v3);
    expect(back[0]!.type).toBe('text');
    expect((back[0] as RichText & { type: 'text' }).text.content).toBe('Hello world');
  });

  it('encodes bold + italic + link + color', () => {
    const nodes: RichText[] = [
      {
        type: 'text',
        text: { content: 'Hi', link: { url: 'https://x.com' } },
        annotations: {
          bold: true,
          italic: true,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'red',
        },
        plain_text: 'Hi',
        href: 'https://x.com',
      },
    ];
    const v3 = richTextToV3(nodes);
    expect(v3[0]![0]).toBe('Hi');
    const marks = v3[0]![1]!;
    expect(marks.some((m) => m[0] === 'b')).toBe(true);
    expect(marks.some((m) => m[0] === 'i')).toBe(true);
    expect(marks.some((m) => m[0] === 'h' && m[1] === 'red')).toBe(true);
    expect(marks.some((m) => m[0] === 'a' && m[1] === 'https://x.com')).toBe(true);
    const back = v3ToRichText(v3);
    const t = back[0] as RichText & { type: 'text' };
    expect(t.annotations.bold).toBe(true);
    expect(t.annotations.italic).toBe(true);
    expect(t.annotations.color).toBe('red');
    expect(t.text.link?.url).toBe('https://x.com');
  });

  it('round-trips a user mention', () => {
    const nodes: RichText[] = [
      {
        type: 'mention',
        mention: { type: 'user', user: { id: '11111111-1111-1111-1111-111111111111' } },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default',
        },
        plain_text: '@alice',
        href: null,
      },
    ];
    const v3 = richTextToV3(nodes);
    const back = v3ToRichText(v3);
    expect(back[0]!.type).toBe('mention');
    const m = back[0] as RichText & { type: 'mention' };
    expect(m.mention.type).toBe('user');
  });

  it('round-trips an equation', () => {
    const nodes: RichText[] = [
      {
        type: 'equation',
        equation: { expression: 'E = mc^2' },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default',
        },
        plain_text: 'E = mc^2',
        href: null,
      },
    ];
    const v3 = richTextToV3(nodes);
    const back = v3ToRichText(v3);
    expect(back[0]!.type).toBe('equation');
  });
});
