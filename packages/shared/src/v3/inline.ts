import type { RichText, RichTextColor } from '../rich-text.ts';

/** v3 inline mark — `[type, ...args]` positional. */
export type V3Mark =
  | ['b']
  | ['i']
  | ['c']
  | ['s']
  | ['_']
  | ['h', RichTextColor]
  | ['a', string]
  | ['u', string]
  | ['p', string]
  | ['d', { start: string; end?: string | null; time_zone?: string | null }]
  | ['e', string]
  | ['eoi', string]
  | ['m', string];

/** v3 inline segment — `[content, marks?]`. */
export type V3Segment = [string] | [string, V3Mark[]];

/** Convert a v1 RichText[] to a v3 segment array. */
export function richTextToV3(nodes: RichText[]): V3Segment[] {
  const out: V3Segment[] = [];
  for (const node of nodes) {
    const marks: V3Mark[] = [];
    if (node.annotations.bold) marks.push(['b']);
    if (node.annotations.italic) marks.push(['i']);
    if (node.annotations.strikethrough) marks.push(['s']);
    if (node.annotations.underline) marks.push(['_']);
    if (node.annotations.code) marks.push(['c']);
    if (node.annotations.color !== 'default') marks.push(['h', node.annotations.color]);
    if (node.type === 'text') {
      if (node.text.link !== null && node.text.link !== undefined) {
        marks.push(['a', node.text.link.url]);
      }
      out.push(marks.length > 0 ? [node.text.content, marks] : [node.text.content]);
    } else if (node.type === 'mention') {
      const m = node.mention;
      if (m.type === 'user') marks.push(['u', m.user.id]);
      else if (m.type === 'page') marks.push(['p', m.page.id]);
      else if (m.type === 'date') marks.push(['d', m.date]);
      else if (m.type === 'link_preview') marks.push(['eoi', m.link_preview.url]);
      out.push([node.plain_text || '@mention', marks]);
    } else {
      // equation
      marks.push(['e', node.equation.expression]);
      out.push([node.plain_text || node.equation.expression, marks]);
    }
  }
  return out;
}

/** Reverse: build a v1 RichText[] from v3 segments. */
export function v3ToRichText(segments: V3Segment[]): RichText[] {
  const out: RichText[] = [];
  for (const seg of segments) {
    const [content, marks = []] = seg;
    const annotations = {
      bold: marks.some((m) => m[0] === 'b'),
      italic: marks.some((m) => m[0] === 'i'),
      strikethrough: marks.some((m) => m[0] === 's'),
      underline: marks.some((m) => m[0] === '_'),
      code: marks.some((m) => m[0] === 'c'),
      color: ((marks.find((m) => m[0] === 'h') as ['h', RichTextColor] | undefined)?.[1] ??
        'default') as RichTextColor,
    };
    const linkMark = marks.find((m) => m[0] === 'a') as ['a', string] | undefined;
    const userMark = marks.find((m) => m[0] === 'u') as ['u', string] | undefined;
    const pageMark = marks.find((m) => m[0] === 'p') as ['p', string] | undefined;
    const dateMark = marks.find((m) => m[0] === 'd') as
      | ['d', { start: string; end?: string | null; time_zone?: string | null }]
      | undefined;
    const eqMark = marks.find((m) => m[0] === 'e') as ['e', string] | undefined;
    const lpMark = marks.find((m) => m[0] === 'eoi') as ['eoi', string] | undefined;

    if (userMark !== undefined) {
      out.push({
        type: 'mention',
        mention: { type: 'user', user: { id: userMark[1] } },
        annotations,
        plain_text: content,
        href: null,
      });
    } else if (pageMark !== undefined) {
      out.push({
        type: 'mention',
        mention: { type: 'page', page: { id: pageMark[1] } },
        annotations,
        plain_text: content,
        href: null,
      });
    } else if (dateMark !== undefined) {
      out.push({
        type: 'mention',
        mention: {
          type: 'date',
          date: {
            start: dateMark[1].start,
            end: dateMark[1].end ?? null,
            time_zone: dateMark[1].time_zone ?? null,
          },
        },
        annotations,
        plain_text: content,
        href: null,
      });
    } else if (lpMark !== undefined) {
      out.push({
        type: 'mention',
        mention: { type: 'link_preview', link_preview: { url: lpMark[1] } },
        annotations,
        plain_text: content,
        href: lpMark[1],
      });
    } else if (eqMark !== undefined) {
      out.push({
        type: 'equation',
        equation: { expression: eqMark[1] },
        annotations,
        plain_text: content,
        href: null,
      });
    } else {
      out.push({
        type: 'text',
        text: {
          content,
          link: linkMark !== undefined ? { url: linkMark[1] } : null,
        },
        annotations,
        plain_text: content,
        href: linkMark?.[1] ?? null,
      });
    }
  }
  return out;
}
