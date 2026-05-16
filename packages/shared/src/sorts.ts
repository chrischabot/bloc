import { z } from 'zod';

const SortDirection = z.enum(['ascending', 'descending']);

const PropertySortSchema = z
  .object({
    property: z.string(),
    direction: SortDirection,
  })
  .strict();

const TimestampSortSchema = z
  .object({
    timestamp: z.enum(['created_time', 'last_edited_time']),
    direction: SortDirection,
  })
  .strict();

export const SortEntrySchema = z.union([PropertySortSchema, TimestampSortSchema]);

export const SortArraySchema = z.array(SortEntrySchema).max(8);

export type SortEntry = z.infer<typeof SortEntrySchema>;
export type SortArray = z.infer<typeof SortArraySchema>;
