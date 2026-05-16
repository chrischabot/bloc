import { z } from 'zod';

/** Per-field override on a form view. */
export const FormFieldSchema = z
  .object({
    property_id: z.string().uuid(),
    required: z.boolean().default(false),
    label_override: z.string().max(120).optional(),
    help: z.string().max(500).optional(),
    default: z.unknown().optional(),
  })
  .strict();
export type FormField = z.infer<typeof FormFieldSchema>;

export const FormConfigSchema = z
  .object({
    kind: z.literal('form'),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).default(''),
    fields: z.array(FormFieldSchema).max(50).default([]),
    submit_label: z.string().max(40).default('Submit'),
    confirmation: z
      .object({
        message: z.string().max(500).default('Thanks!'),
        redirect_url: z.string().url().nullable().default(null),
      })
      .strict()
      .default({ message: 'Thanks!', redirect_url: null }),
    policy: z.enum(['public', 'workspace', 'people']).default('workspace'),
    single_submission_per_user: z.boolean().default(false),
    max_submissions: z.number().int().min(1).max(1_000_000).nullable().default(null),
    close_at: z.string().datetime().nullable().default(null),
    design: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type FormConfig = z.infer<typeof FormConfigSchema>;

/** Submission body: keyed by property name or id; values are passthrough objects (per-property validated by route). */
export const SubmissionBodySchema = z
  .object({
    values: z.record(z.string(), z.object({}).passthrough()),
    files: z.array(z.string().uuid()).max(20).optional(),
    turnstile_token: z.string().optional(),
  })
  .strict();
