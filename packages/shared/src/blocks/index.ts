import { z } from 'zod';
import {
  ColorEnum,
  HttpsUrlSchema,
  type RichText,
  RichTextArraySchema,
  derivePlainText,
} from '../rich-text.ts';

/** Common block envelope fields the API returns on every block. */
export const BlockEnvelopeSchema = z.object({
  object: z.literal('block'),
  id: z.string().uuid(),
  parent: z.object({
    type: z.enum(['page_id', 'block_id', 'database_id', 'workspace']),
    page_id: z.string().uuid().optional(),
    block_id: z.string().uuid().optional(),
    database_id: z.string().uuid().optional(),
    workspace: z.boolean().optional(),
  }),
  created_time: z.string(),
  created_by: z.object({ object: z.literal('user'), id: z.string().uuid() }),
  last_edited_time: z.string(),
  last_edited_by: z.object({ object: z.literal('user'), id: z.string().uuid() }),
  archived: z.boolean().default(false),
  in_trash: z.boolean().default(false),
  has_children: z.boolean().default(false),
});

const fileExternal = z.object({
  type: z.literal('external'),
  external: z.object({ url: HttpsUrlSchema }),
  caption: RichTextArraySchema.default([]),
});

const fileObject = z.object({
  type: z.literal('file'),
  file: z.object({ url: HttpsUrlSchema, expiry_time: z.string() }),
  caption: RichTextArraySchema.default([]),
});

const fileLike = z.discriminatedUnion('type', [fileExternal, fileObject]);

const iconSchema = z.union([
  z.object({ type: z.literal('emoji'), emoji: z.string() }),
  z.object({ type: z.literal('external'), external: z.object({ url: HttpsUrlSchema }) }),
  z.object({
    type: z.literal('file'),
    file: z.object({ url: HttpsUrlSchema, expiry_time: z.string() }),
  }),
]);

/** Payload schemas keyed by block-type discriminator. */

const paragraph = z.object({
  rich_text: RichTextArraySchema,
  color: ColorEnum.default('default'),
});

const headingX = z.object({
  rich_text: RichTextArraySchema,
  color: ColorEnum.default('default'),
  is_toggleable: z.boolean().default(false),
});

const listItem = paragraph;

const toDo = z.object({
  rich_text: RichTextArraySchema,
  checked: z.boolean().default(false),
  color: ColorEnum.default('default'),
});

const code = z.object({
  rich_text: RichTextArraySchema,
  caption: RichTextArraySchema.default([]),
  language: z.string().default('plain text'),
});

const callout = z.object({
  rich_text: RichTextArraySchema,
  icon: iconSchema.nullable().default(null),
  color: ColorEnum.default('default'),
});

const quote = paragraph;
const toggle = paragraph;

const equation = z.object({ expression: z.string().min(1) });
const divider = z.object({}).strict();
const breadcrumb = z.object({}).strict();
const tableOfContents = z.object({ color: ColorEnum.default('default') });
const columnList = z.object({}).strict();
const column = z.object({ width_ratio: z.number().min(0).max(1).optional() });

const link_to_page = z.object({
  type: z.enum(['page_id', 'database_id', 'comment_id']),
  page_id: z.string().uuid().optional(),
  database_id: z.string().uuid().optional(),
  comment_id: z.string().uuid().optional(),
});

const child_page = z.object({ title: z.string().default('Untitled') });
const child_database = z.object({ title: z.string().default('Untitled') });

const tableBlock = z.object({
  table_width: z.number().int().min(1).max(100),
  has_column_header: z.boolean().default(false),
  has_row_header: z.boolean().default(false),
});

const tableRow = z.object({
  cells: z.array(RichTextArraySchema),
});

const bookmark = z.object({
  url: HttpsUrlSchema,
  caption: RichTextArraySchema.default([]),
});

const embed = z.object({
  url: HttpsUrlSchema,
  caption: RichTextArraySchema.default([]),
});

const linkPreview = z.object({ url: HttpsUrlSchema });

const synced = z.object({
  synced_from: z.object({ block_id: z.string().uuid() }).nullable().default(null),
});

const templateBlock = z.object({
  rich_text: RichTextArraySchema,
});

const unsupported = z.object({}).strict();

const audio = fileLike;
const buttonBlock = z.object({
  label: z.string().min(1).max(80),
  icon: iconSchema.nullable().default(null),
  style: z.enum(['default', 'outline', 'filled', 'icon']).default('default'),
  color: ColorEnum.default('default'),
  /** Action steps — full schema in docs/api/schemas/automation-actions.md. */
  steps: z.array(z.record(z.string(), z.unknown())).max(50).default([]),
  confirm: z
    .object({ enabled: z.boolean().default(false), message: z.string().default('') })
    .default({ enabled: false, message: '' }),
});

const chartBlock = z.object({
  config: z.record(z.string(), z.unknown()),
  title: z.string().optional(),
  description: RichTextArraySchema.optional(),
});

const meetingNotes = z.object({
  recording_id: z.string().uuid().optional(),
  language: z.string().default('en'),
  speakers: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  sections: z
    .object({
      summary: RichTextArraySchema.default([]),
      key_points: RichTextArraySchema.default([]),
      action_items: RichTextArraySchema.default([]),
      decisions: RichTextArraySchema.default([]),
    })
    .default({ summary: [], key_points: [], action_items: [], decisions: [] }),
  transcript_visible: z.boolean().default(false),
});

const aiBlock = z.object({
  prompt: RichTextArraySchema,
  output: RichTextArraySchema.default([]),
  model: z.string().default('default'),
  last_run_at: z.string().optional(),
});

const subPageList = z.object({
  filter: z.object({ archived: z.boolean().optional() }).optional(),
  sort: z.enum(['manual', 'recent']).default('manual'),
});

/**
 * Catalogue: maps block-type discriminator to the corresponding payload schema.
 * 38 supported block types — the public Notion superset (paragraph through
 * sub_page_list). See `docs/api/schemas/block-types.md`.
 */
export const BLOCK_PAYLOADS = {
  paragraph,
  heading_1: headingX,
  heading_2: headingX,
  heading_3: headingX,
  bulleted_list_item: listItem,
  numbered_list_item: listItem,
  to_do: toDo,
  toggle,
  code,
  child_page,
  child_database,
  embed,
  image: fileLike,
  video: fileLike,
  file: fileLike,
  pdf: fileLike,
  audio,
  bookmark,
  callout,
  quote,
  equation,
  divider,
  table_of_contents: tableOfContents,
  breadcrumb,
  column_list: columnList,
  column,
  link_preview: linkPreview,
  synced_block: synced,
  template: templateBlock,
  link_to_page,
  table: tableBlock,
  table_row: tableRow,
  unsupported,
  button: buttonBlock,
  chart: chartBlock,
  meeting_notes: meetingNotes,
  ai_block: aiBlock,
  sub_page_list: subPageList,
} as const;

export type BlockType = keyof typeof BLOCK_PAYLOADS;

/** All supported block types as a tuple (useful for `z.enum`). */
export const BLOCK_TYPES = Object.keys(BLOCK_PAYLOADS) as readonly BlockType[];

/** Build the discriminated-union schema for the full block-type set. */
const blockVariants = BLOCK_TYPES.map((type) => {
  const payload = BLOCK_PAYLOADS[type];
  return BlockEnvelopeSchema.extend({
    type: z.literal(type),
    [type]: payload,
  }).strict();
}) as readonly z.ZodObject<z.ZodRawShape>[];

/** Full block-object schema (discriminated by `type`). */
export const BlockSchema = z.union(blockVariants as never) as z.ZodTypeAny;

/** Input shape for `PATCH /blocks/:id/children` etc.: type + payload only. */
export function BlockInputSchema(type: BlockType): z.ZodObject<z.ZodRawShape> {
  return z
    .object({
      type: z.literal(type),
      [type]: BLOCK_PAYLOADS[type],
    })
    .strict();
}

/** Validate any incoming block-input shape regardless of type. */
export const AnyBlockInputSchema = z
  .object({
    type: z.enum(BLOCK_TYPES as [BlockType, ...BlockType[]]),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const t = value.type as BlockType;
    const payload = (value as Record<string, unknown>)[t];
    const result = BLOCK_PAYLOADS[t].safeParse(payload);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: [t, ...issue.path],
          message: issue.message,
        });
      }
    }
  });

/** Type-narrowing predicate. */
export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}

/** Compute the `plain_text` string of any rich-text–bearing block payload. */
export function deriveBlockPlainText(type: BlockType, payload: unknown): string {
  if (payload === null || typeof payload !== 'object') return '';
  const obj = payload as Record<string, unknown>;
  const rt = obj['rich_text'];
  if (Array.isArray(rt)) {
    return (rt as RichText[]).map(derivePlainText).join('');
  }
  if (type === 'equation' && typeof obj['expression'] === 'string') return obj['expression'];
  if (type === 'code') {
    const codeText = obj['rich_text'];
    if (Array.isArray(codeText)) return (codeText as RichText[]).map(derivePlainText).join('');
  }
  return '';
}
