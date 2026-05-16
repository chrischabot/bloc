import { z } from 'zod';
import { HttpsUrlSchema, LinkUrlSchema, RichTextArraySchema } from '../rich-text.ts';

/** Canonical foreground colour for select / status / multi_select options. */
const OptionColor = z.enum([
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
]);

/** Single option for select / multi_select / status. */
export const OptionSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    color: OptionColor.default('default'),
    description: z.string().nullable().default(null),
  })
  .strict();
export type Option = z.infer<typeof OptionSchema>;

/** Status property has groups (To-do / In progress / Done). */
export const StatusGroupSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    color: OptionColor.default('default'),
    option_ids: z.array(z.string().uuid()).default([]),
  })
  .strict();

/** Number format enum (subset matches the documented Notion list). */
export const NumberFormat = z.enum([
  'number',
  'number_with_commas',
  'percent',
  'dollar',
  'canadian_dollar',
  'euro',
  'pound',
  'yen',
  'rupee',
  'won',
  'real',
  'lira',
  'ruble',
  'rupiah',
  'franc',
  'hong_kong_dollar',
  'new_zealand_dollar',
  'krona',
  'norwegian_krone',
  'mexican_peso',
  'rand',
  'new_taiwan_dollar',
  'danish_krone',
  'zloty',
  'baht',
  'forint',
  'koruna',
  'shekel',
  'chilean_peso',
  'philippine_peso',
  'dirham',
  'riyal',
  'ringgit',
  'leu',
  'argentine_peso',
  'uruguayan_peso',
]);

/** Rollup aggregation function. */
export const RollupFunction = z.enum([
  'show_original',
  'show_unique',
  'count',
  'count_values',
  'empty',
  'not_empty',
  'unique',
  'percent_empty',
  'percent_not_empty',
  'sum',
  'average',
  'median',
  'min',
  'max',
  'range',
  'earliest_date',
  'latest_date',
  'date_range',
  'checked',
  'unchecked',
  'percent_checked',
  'percent_unchecked',
]);

// ---------------------------------------------------------------------------
// PROPERTY CONFIG SCHEMAS — schema-side, per property type
// ---------------------------------------------------------------------------

const titleCfg = z.object({}).strict();
const richTextCfg = z.object({}).strict();
const numberCfg = z.object({ format: NumberFormat.default('number') }).strict();
const selectCfg = z.object({ options: z.array(OptionSchema).default([]) }).strict();
const multiSelectCfg = z.object({ options: z.array(OptionSchema).default([]) }).strict();
const statusCfg = z
  .object({
    options: z.array(OptionSchema).default([]),
    groups: z.array(StatusGroupSchema).default([]),
  })
  .strict();
const dateCfg = z.object({}).strict();
const peopleCfg = z.object({}).strict();
const filesCfg = z.object({}).strict();
const checkboxCfg = z.object({}).strict();
const urlCfg = z.object({}).strict();
const emailCfg = z.object({}).strict();
const phoneCfg = z.object({}).strict();
const formulaCfg = z.object({ expression: z.string().min(1) }).strict();
const relationCfg = z
  .object({
    database_id: z.string().uuid(),
    type: z.enum(['single_property', 'dual_property']).default('single_property'),
    single_property: z.object({}).optional(),
    dual_property: z
      .object({
        synced_property_id: z.string().uuid().optional(),
        synced_property_name: z.string().optional(),
      })
      .optional(),
  })
  .strict();
const rollupCfg = z
  .object({
    relation_property_id: z.string().uuid().optional(),
    relation_property_name: z.string().optional(),
    rollup_property_id: z.string().uuid().optional(),
    rollup_property_name: z.string().optional(),
    function: RollupFunction.default('count'),
  })
  .strict();
const createdTimeCfg = z.object({}).strict();
const createdByCfg = z.object({}).strict();
const lastEditedTimeCfg = z.object({}).strict();
const lastEditedByCfg = z.object({}).strict();
const verificationCfg = z.object({}).strict();
const uniqueIdCfg = z.object({ prefix: z.string().max(40).nullable().default(null) }).strict();
const buttonCfg = z.object({}).strict();

/** Catalogue: property-type discriminator → config schema. */
export const PROPERTY_CONFIGS = {
  title: titleCfg,
  rich_text: richTextCfg,
  number: numberCfg,
  select: selectCfg,
  multi_select: multiSelectCfg,
  status: statusCfg,
  date: dateCfg,
  people: peopleCfg,
  files: filesCfg,
  checkbox: checkboxCfg,
  url: urlCfg,
  email: emailCfg,
  phone_number: phoneCfg,
  formula: formulaCfg,
  relation: relationCfg,
  rollup: rollupCfg,
  created_time: createdTimeCfg,
  created_by: createdByCfg,
  last_edited_time: lastEditedTimeCfg,
  last_edited_by: lastEditedByCfg,
  verification: verificationCfg,
  unique_id: uniqueIdCfg,
  button: buttonCfg,
} as const;

export type PropertyType = keyof typeof PROPERTY_CONFIGS;
export const PROPERTY_TYPES = Object.keys(PROPERTY_CONFIGS) as readonly PropertyType[];

export function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// PROPERTY VALUE SCHEMAS — page-side, per property type
// ---------------------------------------------------------------------------

const userRef = z
  .object({
    object: z.literal('user').default('user'),
    id: z.string().uuid(),
  })
  .passthrough();

const dateValue = z
  .object({
    start: z.string(),
    end: z.string().nullable().default(null),
    time_zone: z.string().nullable().default(null),
  })
  .strict();

const fileRef = z.union([
  z.object({
    type: z.literal('external'),
    name: z.string().optional(),
    external: z.object({ url: HttpsUrlSchema }),
  }),
  z.object({
    type: z.literal('file'),
    name: z.string().optional(),
    file: z.object({ url: HttpsUrlSchema, expiry_time: z.string() }),
  }),
]);

const titleVal = z.object({ title: RichTextArraySchema });
const richTextVal = z.object({ rich_text: RichTextArraySchema });
const numberVal = z.object({ number: z.number().nullable() });
const selectVal = z.object({
  select: OptionSchema.partial({ description: true }).nullable(),
});
const multiSelectVal = z.object({
  multi_select: z.array(OptionSchema.partial({ description: true })),
});
const statusVal = z.object({
  status: OptionSchema.partial({ description: true }).nullable(),
});
const dateVal = z.object({ date: dateValue.nullable() });
const peopleVal = z.object({ people: z.array(userRef) });
const filesVal = z.object({ files: z.array(fileRef) });
const checkboxVal = z.object({ checkbox: z.boolean() });
const urlVal = z.object({ url: LinkUrlSchema.nullable() });
const emailVal = z.object({ email: z.string().email().nullable() });
const phoneVal = z.object({ phone_number: z.string().nullable() });
const formulaVal = z.object({
  formula: z.union([
    z.object({ type: z.literal('string'), string: z.string().nullable() }),
    z.object({ type: z.literal('number'), number: z.number().nullable() }),
    z.object({ type: z.literal('boolean'), boolean: z.boolean().nullable() }),
    z.object({ type: z.literal('date'), date: dateValue.nullable() }),
  ]),
});
const relationVal = z.object({
  relation: z.array(z.object({ id: z.string().uuid() })),
  has_more: z.boolean().default(false).optional(),
});
const rollupVal = z.object({
  rollup: z.object({
    function: RollupFunction,
    type: z.enum(['number', 'date', 'array', 'incomplete', 'unsupported']),
    number: z.number().nullable().optional(),
    date: dateValue.nullable().optional(),
    array: z.array(z.unknown()).optional(),
    incomplete: z.object({}).optional(),
  }),
});
const createdTimeVal = z.object({ created_time: z.string() });
const createdByVal = z.object({ created_by: userRef });
const lastEditedTimeVal = z.object({ last_edited_time: z.string() });
const lastEditedByVal = z.object({ last_edited_by: userRef });
const verificationVal = z.object({
  verification: z
    .object({
      state: z.enum(['verified', 'unverified']),
      verified_by: userRef.nullable().default(null),
      verified_at: z.string().nullable().default(null),
      expires_at: z.string().nullable().default(null),
    })
    .nullable(),
});
const uniqueIdVal = z.object({
  unique_id: z.object({
    prefix: z.string().nullable(),
    number: z.number().int(),
  }),
});
const buttonVal = z.object({ button: z.object({}).strict() });

/** Catalogue: property-type discriminator → value-payload schema (without `id`/`type`). */
export const PROPERTY_VALUE_PAYLOADS = {
  title: titleVal,
  rich_text: richTextVal,
  number: numberVal,
  select: selectVal,
  multi_select: multiSelectVal,
  status: statusVal,
  date: dateVal,
  people: peopleVal,
  files: filesVal,
  checkbox: checkboxVal,
  url: urlVal,
  email: emailVal,
  phone_number: phoneVal,
  formula: formulaVal,
  relation: relationVal,
  rollup: rollupVal,
  created_time: createdTimeVal,
  created_by: createdByVal,
  last_edited_time: lastEditedTimeVal,
  last_edited_by: lastEditedByVal,
  verification: verificationVal,
  unique_id: uniqueIdVal,
  button: buttonVal,
} as const;

/**
 * Build an input schema for setting a single property value on a page. The
 * shape is `{ <type>: <value> }` — Notion's `properties` map omits the `type`
 * field when writing (server infers from the database schema).
 */
export function PropertyValueInputSchema(type: PropertyType): z.ZodTypeAny {
  return PROPERTY_VALUE_PAYLOADS[type];
}

/**
 * Input shape for the `properties` map on `POST /v1/pages` / `PATCH /v1/pages`.
 * Keys are property names or ids; values are passthrough objects (per-property
 * validation is applied against the database's schema by the route handler).
 */
export const PagePropertiesInputSchema = z.record(z.string(), z.object({}).passthrough());

/** Convenient writeable-vs-readonly classification used by the route layer. */
export const READONLY_PROPERTY_TYPES = new Set<PropertyType>([
  'formula',
  'rollup',
  'created_time',
  'created_by',
  'last_edited_time',
  'last_edited_by',
  'unique_id',
  'button',
]);

export function isReadonlyPropertyType(type: PropertyType): boolean {
  return READONLY_PROPERTY_TYPES.has(type);
}
