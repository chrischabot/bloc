import { z } from 'zod';

// ---------------------------------------------------------------------------
// PER-PROPERTY-TYPE OPERATOR SCHEMAS
// ---------------------------------------------------------------------------

const stringOps = z.union([
  z.object({ equals: z.string() }).strict(),
  z.object({ does_not_equal: z.string() }).strict(),
  z.object({ contains: z.string() }).strict(),
  z.object({ does_not_contain: z.string() }).strict(),
  z.object({ starts_with: z.string() }).strict(),
  z.object({ ends_with: z.string() }).strict(),
  z.object({ is_empty: z.literal(true) }).strict(),
  z.object({ is_not_empty: z.literal(true) }).strict(),
]);

const numberOps = z.union([
  z.object({ equals: z.number() }).strict(),
  z.object({ does_not_equal: z.number() }).strict(),
  z.object({ greater_than: z.number() }).strict(),
  z.object({ less_than: z.number() }).strict(),
  z.object({ greater_than_or_equal_to: z.number() }).strict(),
  z.object({ less_than_or_equal_to: z.number() }).strict(),
  z.object({ is_empty: z.literal(true) }).strict(),
  z.object({ is_not_empty: z.literal(true) }).strict(),
]);

const checkboxOps = z.union([
  z.object({ equals: z.boolean() }).strict(),
  z.object({ does_not_equal: z.boolean() }).strict(),
]);

const selectOps = z.union([
  z.object({ equals: z.string() }).strict(),
  z.object({ does_not_equal: z.string() }).strict(),
  z.object({ is_empty: z.literal(true) }).strict(),
  z.object({ is_not_empty: z.literal(true) }).strict(),
]);

const multiSelectOps = z.union([
  z.object({ contains: z.string() }).strict(),
  z.object({ does_not_contain: z.string() }).strict(),
  z.object({ is_empty: z.literal(true) }).strict(),
  z.object({ is_not_empty: z.literal(true) }).strict(),
]);

const dateOps = z.union([
  z.object({ equals: z.string() }).strict(),
  z.object({ before: z.string() }).strict(),
  z.object({ after: z.string() }).strict(),
  z.object({ on_or_before: z.string() }).strict(),
  z.object({ on_or_after: z.string() }).strict(),
  z.object({ past_week: z.object({}) }).strict(),
  z.object({ past_month: z.object({}) }).strict(),
  z.object({ past_year: z.object({}) }).strict(),
  z.object({ next_week: z.object({}) }).strict(),
  z.object({ next_month: z.object({}) }).strict(),
  z.object({ next_year: z.object({}) }).strict(),
  z.object({ this_week: z.object({}) }).strict(),
  z.object({ is_empty: z.literal(true) }).strict(),
  z.object({ is_not_empty: z.literal(true) }).strict(),
]);

const peopleOps = z.union([
  z.object({ contains: z.string().uuid() }).strict(),
  z.object({ does_not_contain: z.string().uuid() }).strict(),
  z.object({ is_empty: z.literal(true) }).strict(),
  z.object({ is_not_empty: z.literal(true) }).strict(),
]);

const relationOps = peopleOps;

const filesOps = z.union([
  z.object({ is_empty: z.literal(true) }).strict(),
  z.object({ is_not_empty: z.literal(true) }).strict(),
]);

const formulaOps = z
  .object({
    string: stringOps.optional(),
    number: numberOps.optional(),
    checkbox: checkboxOps.optional(),
    date: dateOps.optional(),
  })
  .strict()
  .refine((obj) => Object.values(obj).filter((v) => v !== undefined).length === 1, {
    message: 'Exactly one of string/number/checkbox/date must be provided',
  });

const rollupOps = z
  .object({
    number: numberOps.optional(),
    date: dateOps.optional(),
    any: z.record(z.string(), z.unknown()).optional(),
    every: z.record(z.string(), z.unknown()).optional(),
    none: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/** Map of property-type discriminator → operator schema. */
const FILTER_OPS_BY_TYPE: Record<string, z.ZodTypeAny> = {
  title: stringOps,
  rich_text: stringOps,
  url: stringOps,
  email: stringOps,
  phone_number: stringOps,
  number: numberOps,
  checkbox: checkboxOps,
  select: selectOps,
  status: selectOps,
  multi_select: multiSelectOps,
  date: dateOps,
  created_time: dateOps,
  last_edited_time: dateOps,
  people: peopleOps,
  created_by: peopleOps,
  last_edited_by: peopleOps,
  files: filesOps,
  relation: relationOps,
  formula: formulaOps,
  rollup: rollupOps,
};

export const FILTERABLE_TYPES = Object.keys(FILTER_OPS_BY_TYPE);

/**
 * Single property filter: `{ property: <name>, <type>: <operator-obj> }`.
 * Validates that exactly one type key is set and matches the per-type ops schema.
 */
export const PropertyFilterSchema: z.ZodTypeAny = z
  .object({ property: z.string().min(1) })
  .passthrough()
  .superRefine((value, ctx) => {
    const obj = value as Record<string, unknown>;
    const typeKeys = Object.keys(obj).filter((k) => k !== 'property');
    if (typeKeys.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: `Property filter must have exactly one type key, found ${typeKeys.length}`,
      });
      return;
    }
    const typeKey = typeKeys[0] as string;
    const opsSchema = FILTER_OPS_BY_TYPE[typeKey];
    if (!opsSchema) {
      ctx.addIssue({
        code: 'custom',
        path: [typeKey],
        message: `Unknown property-filter type '${typeKey}'`,
      });
      return;
    }
    const result = opsSchema.safeParse(obj[typeKey]);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: [typeKey, ...issue.path],
          message: issue.message,
        });
      }
    }
  });

export type PropertyFilter = z.infer<typeof PropertyFilterSchema>;

// ---------------------------------------------------------------------------
// COMPOUND FILTERS (and/or, depth ≤ 2)
// ---------------------------------------------------------------------------

const MAX_NESTING_DEPTH = 2;

function depthOf(filter: unknown): number {
  if (filter === null || typeof filter !== 'object') return 0;
  const obj = filter as Record<string, unknown>;
  if (Array.isArray(obj['and'])) {
    return 1 + Math.max(0, ...(obj['and'] as unknown[]).map(depthOf));
  }
  if (Array.isArray(obj['or'])) {
    return 1 + Math.max(0, ...(obj['or'] as unknown[]).map(depthOf));
  }
  return 0;
}

/** Recursive filter object schema. */
export const FilterSchema: z.ZodTypeAny = z.lazy(() =>
  z
    .union([
      PropertyFilterSchema,
      z.object({ and: z.array(FilterSchema).min(1) }).strict(),
      z.object({ or: z.array(FilterSchema).min(1) }).strict(),
    ])
    .superRefine((value, ctx) => {
      const d = depthOf(value);
      if (d > MAX_NESTING_DEPTH) {
        ctx.addIssue({
          code: 'custom',
          message: `Filter nesting depth ${d} exceeds maximum of ${MAX_NESTING_DEPTH}`,
        });
      }
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        if (obj['and'] !== undefined && obj['or'] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: "Cannot mix 'and' and 'or' at the same level",
          });
        }
      }
    }),
);

export type FilterObject = z.infer<typeof FilterSchema>;
