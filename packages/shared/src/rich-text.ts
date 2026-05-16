import { z } from 'zod';

/** The 19-value rich-text colour palette (10 foreground + 9 background). */
export const RICH_TEXT_COLORS = [
  'default',
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
  'gray_background',
  'brown_background',
  'orange_background',
  'yellow_background',
  'green_background',
  'blue_background',
  'purple_background',
  'pink_background',
  'red_background',
] as const;

export type RichTextColor = (typeof RICH_TEXT_COLORS)[number];

export const ColorEnum = z.enum(RICH_TEXT_COLORS);

export const AnnotationsSchema = z
  .object({
    bold: z.boolean().default(false),
    italic: z.boolean().default(false),
    strikethrough: z.boolean().default(false),
    underline: z.boolean().default(false),
    code: z.boolean().default(false),
    color: ColorEnum.default('default'),
  })
  .strict();

export type Annotations = z.infer<typeof AnnotationsSchema>;

const MAX_TEXT_CONTENT = 2000;
const MAX_URL_LENGTH = 2000;

/**
 * URL restricted to web-safe schemes. Rejects `javascript:`, `data:`, `file:`,
 * `gopher:` etc. per docs/architecture/08-security.md#xss.
 */
export const HttpsUrlSchema = z
  .string()
  .max(MAX_URL_LENGTH)
  .refine(
    (s) => {
      try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must use http or https' },
  );

/** URL that additionally allows `mailto:` and `tel:` for inline link annotations. */
export const LinkUrlSchema = z
  .string()
  .max(MAX_URL_LENGTH)
  .refine(
    (s) => {
      try {
        const u = new URL(s);
        return (
          u.protocol === 'http:' ||
          u.protocol === 'https:' ||
          u.protocol === 'mailto:' ||
          u.protocol === 'tel:'
        );
      } catch {
        return false;
      }
    },
    { message: 'URL must use http, https, mailto, or tel' },
  );

export const TextLinkSchema = z.object({ url: LinkUrlSchema }).strict();

const baseRichText = z.object({
  annotations: AnnotationsSchema.default({}),
  plain_text: z.string().default(''),
  href: LinkUrlSchema.nullable().default(null),
});

export const RichTextTextSchema = baseRichText
  .extend({
    type: z.literal('text'),
    text: z
      .object({
        content: z.string().max(MAX_TEXT_CONTENT),
        link: TextLinkSchema.nullable().default(null),
      })
      .strict(),
  })
  .strict();

export const RichTextMentionSchema = baseRichText
  .extend({
    type: z.literal('mention'),
    mention: z.union([
      z.object({ type: z.literal('user'), user: z.object({ id: z.string().uuid() }) }).strict(),
      z.object({ type: z.literal('page'), page: z.object({ id: z.string().uuid() }) }).strict(),
      z
        .object({ type: z.literal('database'), database: z.object({ id: z.string().uuid() }) })
        .strict(),
      z
        .object({
          type: z.literal('date'),
          date: z
            .object({
              start: z.string(),
              end: z.string().nullable().default(null),
              time_zone: z.string().nullable().default(null),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          type: z.literal('link_preview'),
          link_preview: z.object({ url: HttpsUrlSchema }).strict(),
        })
        .strict(),
      z
        .object({
          type: z.literal('template_mention'),
          template_mention: z.union([
            z
              .object({
                type: z.literal('template_mention_date'),
                template_mention_date: z.enum(['today', 'now']),
              })
              .strict(),
            z
              .object({
                type: z.literal('template_mention_user'),
                template_mention_user: z.literal('me'),
              })
              .strict(),
          ]),
        })
        .strict(),
    ]),
  })
  .strict();

export const RichTextEquationSchema = baseRichText
  .extend({
    type: z.literal('equation'),
    equation: z.object({ expression: z.string().min(1) }).strict(),
  })
  .strict();

export const RichTextSchema = z.discriminatedUnion('type', [
  RichTextTextSchema,
  RichTextMentionSchema,
  RichTextEquationSchema,
]);

export type RichText = z.infer<typeof RichTextSchema>;

export const RichTextArraySchema = z.array(RichTextSchema).max(100);

/**
 * Derive a `plain_text` string from a rich-text node. Server-computed; clients
 * should not set `plain_text` themselves.
 */
export function derivePlainText(node: RichText): string {
  if (node.type === 'text') return node.text.content;
  if (node.type === 'equation') return node.equation.expression;
  // mention
  const m = node.mention;
  switch (m.type) {
    case 'user':
      return '@user';
    case 'page':
      return '@page';
    case 'database':
      return '@database';
    case 'date':
      return m.date.start;
    case 'link_preview':
      return m.link_preview.url;
    case 'template_mention':
      return '@template';
  }
}

/** Derive the `href` for a rich-text node, if any. */
export function deriveHref(node: RichText): string | null {
  if (node.type === 'text') return node.text.link?.url ?? null;
  if (node.type === 'mention' && node.mention.type === 'link_preview') {
    return node.mention.link_preview.url;
  }
  return null;
}
