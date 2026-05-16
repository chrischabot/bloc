import { z } from 'zod';
import { RichTextArraySchema } from '../rich-text.ts';

// ---------------------------------------------------------------------------
// STEP SCHEMAS
// ---------------------------------------------------------------------------

const TemplatedString = z.string().max(10_000);
const PageRef = TemplatedString;

const AddPageStep = z
  .object({
    type: z.literal('add_page_to_database'),
    database_id: z.string().uuid(),
    properties: z.record(z.string(), z.object({}).passthrough()).default({}),
    children: z.array(z.object({}).passthrough()).max(100).default([]),
  })
  .strict();

const EditPagesStep = z
  .object({
    type: z.literal('edit_pages_in_database'),
    database_id: z.string().uuid(),
    filter: z.object({}).passthrough().optional(),
    set: z.record(z.string(), z.object({}).passthrough()),
    limit: z.number().int().min(1).max(1000).default(100),
  })
  .strict();

const EditPropertyStep = z
  .object({
    type: z.enum(['edit_property', 'set_page_property']),
    page_id: PageRef,
    property: z.string(),
    value: z.object({}).passthrough(),
  })
  .strict();

const SendSlackStep = z
  .object({
    type: z.literal('send_slack_message'),
    channel: TemplatedString,
    body: TemplatedString,
    mention_user_ids: z.array(z.string()).default([]),
  })
  .strict();

const SendEmailStep = z
  .object({
    type: z.literal('send_email'),
    to: z.array(TemplatedString).min(1),
    subject: TemplatedString,
    body: TemplatedString,
  })
  .strict();

const SendNotificationStep = z
  .object({
    type: z.literal('send_notification'),
    recipients: z.array(TemplatedString).min(1),
    body: TemplatedString,
  })
  .strict();

const OpenPageStep = z.object({ type: z.literal('open_page'), page_id: PageRef }).strict();

const OpenLinkStep = z.object({ type: z.literal('open_link'), url: z.string().url() }).strict();

const ShowConfirmStep = z
  .object({ type: z.literal('show_confirm'), message: TemplatedString })
  .strict();

const RunAIStep = z
  .object({
    type: z.literal('run_ai'),
    prompt: TemplatedString,
    output_property: z.string(),
  })
  .strict();

const DelayStep = z
  .object({
    type: z.literal('delay'),
    duration: z.string().regex(/^P(?:T?\d+[YMDWHMS])+$/, 'ISO 8601 duration'),
  })
  .strict();

export const StepSchema = z.discriminatedUnion('type', [
  AddPageStep,
  EditPagesStep,
  EditPropertyStep,
  SendSlackStep,
  SendEmailStep,
  SendNotificationStep,
  OpenPageStep,
  OpenLinkStep,
  ShowConfirmStep,
  RunAIStep,
  DelayStep,
]);

export type Step = z.infer<typeof StepSchema>;

export const StepArraySchema = z.array(StepSchema).max(50);

// ---------------------------------------------------------------------------
// TRIGGER SCHEMAS
// ---------------------------------------------------------------------------

export const TriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('page_added') }).strict(),
  z
    .object({
      kind: z.literal('page_property_changed'),
      property_id: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('page_property_meets'),
      property_id: z.string().uuid(),
      condition: z.object({}).passthrough(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('time'),
      cron: z.string().regex(/^[\d\s*/,-]+$/),
      timezone: z.string().default('UTC'),
    })
    .strict(),
]);

export type Trigger = z.infer<typeof TriggerSchema>;

// ---------------------------------------------------------------------------
// TEMPLATING ENGINE
// ---------------------------------------------------------------------------

/** Allowed characters in a template path segment. */
const PATH_RE = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;

/**
 * Resolve a `{{path.to.value}}` template against a variable bag.
 *
 * - Path segments are strictly alphanumeric/underscore (anchored by `PATH_RE`).
 * - Prototype access is rejected (`__proto__`, `constructor`, `prototype`).
 * - Unknown paths render as the empty string and emit a warning to the
 *   provided `onUnknown` callback (if any).
 */
export function renderTemplate(
  template: string,
  bag: Record<string, unknown>,
  options: { onUnknown?: (path: string) => void } = {},
): string {
  return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, rawPath: string) => {
    if (!PATH_RE.test(rawPath)) return '';
    const segments = rawPath.split('.');
    let current: unknown = bag;
    for (const seg of segments) {
      if (seg === '__proto__' || seg === 'constructor' || seg === 'prototype') return '';
      if (current === null || typeof current !== 'object') {
        options.onUnknown?.(rawPath);
        return '';
      }
      current = (current as Record<string, unknown>)[seg];
    }
    if (current === undefined || current === null) {
      options.onUnknown?.(rawPath);
      return '';
    }
    if (typeof current === 'object') return JSON.stringify(current);
    return String(current);
  });
}

/** Render all string leaves in an object recursively (max depth 10). */
export function renderTemplateDeep<T>(value: T, bag: Record<string, unknown>, depth = 0): T {
  if (depth > 10) return value;
  if (typeof value === 'string') {
    return renderTemplate(value, bag) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => renderTemplateDeep(v, bag, depth + 1)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = renderTemplateDeep(v, bag, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

// Re-export to clarify dependencies in tooling.
export { RichTextArraySchema };
