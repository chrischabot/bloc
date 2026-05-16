import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

export const pageProperties = pgTable(
  'page_properties',
  {
    pageId: uuid('page_id').notNull(),
    propertyId: uuid('property_id').notNull(),
    /**
     * Polymorphic envelope: `{ type, <type>: <value> }`.
     * See `docs/api/schemas/property-types.md`.
     */
    value: jsonb('value').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pageId, t.propertyId] }),
    propIdx: index('idx_page_properties_property').on(t.propertyId, sql`(value->>'type')`),
  }),
);
