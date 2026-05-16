import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from './client.ts';
import { databaseProperties } from './schema/pages.ts';
import { pageProperties } from './schema/properties.ts';

export type RollupValue =
  | { function: string; type: 'number'; number: number | null }
  | { function: string; type: 'date'; date: DateValue | null }
  | { function: string; type: 'array'; array: unknown[] }
  | { function: string; type: 'incomplete'; incomplete: Record<string, never> }
  | { function: string; type: 'unsupported'; unsupported: Record<string, never> };

interface DateValue {
  start: string;
  end: string | null;
  time_zone: string | null;
}

export interface RollupArgs {
  sourcePageId: string;
  /** Relation property on the source database. */
  relationPropertyId: string;
  /** Property to roll up on the target database. */
  rollupPropertyId: string;
  /** Aggregation function name. */
  function: string;
}

export async function evaluateRollup(db: Database, args: RollupArgs): Promise<RollupValue> {
  // 1. Read the source page's relation value.
  const [relationRow] = await db
    .select()
    .from(pageProperties)
    .where(
      and(
        eq(pageProperties.pageId, args.sourcePageId),
        eq(pageProperties.propertyId, args.relationPropertyId),
      ),
    )
    .limit(1);
  const relationValue =
    relationRow !== undefined ? ((relationRow.value as Record<string, unknown>) ?? {}) : {};
  const refs = extractRelationIds(relationValue);

  // 2. Resolve the rollup property def to learn its type.
  const [rollupPropDef] = await db
    .select()
    .from(databaseProperties)
    .where(eq(databaseProperties.id, args.rollupPropertyId))
    .limit(1);
  if (!rollupPropDef) {
    return { function: args.function, type: 'unsupported', unsupported: {} };
  }

  // 3. Special-case `count` — pure count of relation refs, no need to read target values.
  if (args.function === 'count') {
    return { function: args.function, type: 'number', number: refs.length };
  }

  // 4. Read target values in one shot.
  let targetValues: unknown[] = [];
  if (refs.length > 0) {
    const rows = await db
      .select()
      .from(pageProperties)
      .where(
        and(
          inArray(pageProperties.pageId, refs),
          eq(pageProperties.propertyId, args.rollupPropertyId),
        ),
      );
    targetValues = rows.map((r) => r.value);
  }

  return aggregate(args.function, rollupPropDef.type, targetValues);
}

function extractRelationIds(value: Record<string, unknown>): string[] {
  const v = value['relation'];
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => (r !== null && typeof r === 'object' ? (r as { id?: string }).id : undefined))
    .filter((id): id is string => typeof id === 'string');
}

function aggregate(fn: string, propertyType: string, values: unknown[]): RollupValue {
  const scalars = values.map((v) => extractScalar(v, propertyType));
  const numbers = scalars.filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
  const dates = scalars
    .filter((s) => typeof s === 'string')
    .map((s) => new Date(s as string).getTime())
    .filter((t) => !Number.isNaN(t));
  const nonEmpty = scalars.filter(
    (s) => s !== null && s !== undefined && s !== '' && s !== 0 && s !== false,
  );
  const total = scalars.length;

  switch (fn) {
    case 'count_values':
      return { function: fn, type: 'number', number: nonEmpty.length };
    case 'count_unique_values':
    case 'unique':
      return {
        function: fn,
        type: 'number',
        number: new Set(scalars.filter((s) => s !== null && s !== undefined)).size,
      };
    case 'percent_empty':
      return {
        function: fn,
        type: 'number',
        number: total === 0 ? 0 : (total - nonEmpty.length) / total,
      };
    case 'percent_not_empty':
      return {
        function: fn,
        type: 'number',
        number: total === 0 ? 0 : nonEmpty.length / total,
      };
    case 'empty':
      return {
        function: fn,
        type: 'number',
        number: scalars.filter((s) => s === null || s === undefined || s === '').length,
      };
    case 'not_empty':
      return { function: fn, type: 'number', number: nonEmpty.length };
    case 'sum':
      return {
        function: fn,
        type: 'number',
        number: numbers.length === 0 ? 0 : numbers.reduce((a, b) => a + b, 0),
      };
    case 'average':
      return {
        function: fn,
        type: 'number',
        number: numbers.length === 0 ? null : numbers.reduce((a, b) => a + b, 0) / numbers.length,
      };
    case 'median': {
      if (numbers.length === 0) return { function: fn, type: 'number', number: null };
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const lower = sorted[mid - 1] ?? sorted[mid] ?? 0;
      const upper = sorted[mid] ?? lower;
      const median = sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
      return { function: fn, type: 'number', number: median };
    }
    case 'min':
      return {
        function: fn,
        type: 'number',
        number: numbers.length === 0 ? null : Math.min(...numbers),
      };
    case 'max':
      return {
        function: fn,
        type: 'number',
        number: numbers.length === 0 ? null : Math.max(...numbers),
      };
    case 'range':
      return {
        function: fn,
        type: 'number',
        number: numbers.length === 0 ? null : Math.max(...numbers) - Math.min(...numbers),
      };
    case 'earliest_date': {
      if (dates.length === 0) return { function: fn, type: 'date', date: null };
      const ts = Math.min(...dates);
      return {
        function: fn,
        type: 'date',
        date: { start: new Date(ts).toISOString(), end: null, time_zone: null },
      };
    }
    case 'latest_date': {
      if (dates.length === 0) return { function: fn, type: 'date', date: null };
      const ts = Math.max(...dates);
      return {
        function: fn,
        type: 'date',
        date: { start: new Date(ts).toISOString(), end: null, time_zone: null },
      };
    }
    case 'date_range': {
      if (dates.length === 0) return { function: fn, type: 'date', date: null };
      return {
        function: fn,
        type: 'date',
        date: {
          start: new Date(Math.min(...dates)).toISOString(),
          end: new Date(Math.max(...dates)).toISOString(),
          time_zone: null,
        },
      };
    }
    case 'show_original':
      return { function: fn, type: 'array', array: values };
    case 'show_unique': {
      const seen = new Set<string>();
      const unique: unknown[] = [];
      for (const v of values) {
        const key = JSON.stringify(v);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(v);
      }
      return { function: fn, type: 'array', array: unique };
    }
    case 'checked':
      return {
        function: fn,
        type: 'number',
        number: scalars.filter((s) => s === true).length,
      };
    case 'unchecked':
      return {
        function: fn,
        type: 'number',
        number: scalars.filter((s) => s === false).length,
      };
    case 'percent_checked':
      return {
        function: fn,
        type: 'number',
        number: total === 0 ? 0 : scalars.filter((s) => s === true).length / total,
      };
    case 'percent_unchecked':
      return {
        function: fn,
        type: 'number',
        number: total === 0 ? 0 : scalars.filter((s) => s === false).length / total,
      };
    default:
      // Mark unsupported but preserve the function name for client display.
      void propertyType;
      return { function: fn, type: 'unsupported', unsupported: {} };
  }
}

function extractScalar(value: unknown, propertyType: string): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  const v = (value as Record<string, unknown>)[propertyType];
  if (propertyType === 'title' || propertyType === 'rich_text') {
    if (!Array.isArray(v)) return '';
    return (v as Array<{ plain_text?: string; text?: { content?: string } }>)
      .map((n) => {
        const pt = n.plain_text;
        if (typeof pt === 'string' && pt.length > 0) return pt;
        return n.text?.content ?? '';
      })
      .join('');
  }
  if (propertyType === 'number' || propertyType === 'checkbox') {
    return v ?? null;
  }
  if (propertyType === 'select' || propertyType === 'status') {
    return (v as { name?: string } | null)?.name ?? null;
  }
  if (propertyType === 'date') {
    return (v as { start?: string } | null)?.start ?? null;
  }
  if (propertyType === 'created_time' || propertyType === 'last_edited_time') {
    return v ?? null;
  }
  if (propertyType === 'url' || propertyType === 'email' || propertyType === 'phone_number') {
    return typeof v === 'string' ? v : '';
  }
  return null;
}
