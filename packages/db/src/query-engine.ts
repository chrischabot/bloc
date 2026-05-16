import {
  type EvalContext,
  FormulaEvalError,
  type FormulaValue,
  evaluateFormula,
} from '@bloc/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './client.ts';
import { type RollupValue, evaluateRollup } from './rollup.ts';
import { databaseProperties, pages } from './schema/pages.ts';
import { pageProperties } from './schema/properties.ts';

type PropertyDef = {
  id: string;
  name: string;
  type: string;
  config?: Record<string, unknown> | null;
};

/** Thrown by `queryDatabase` when a filter references a property that doesn't
 * exist on the database. The route layer converts this to a 400. */
export class UnknownPropertyError extends Error {
  override readonly name = 'UnknownPropertyError';
  readonly propertyName: string;
  constructor(propertyName: string) {
    super(`Unknown property '${propertyName}' on database`);
    this.propertyName = propertyName;
  }
}

interface QueryArgs {
  databaseId: string;
  filter?: unknown;
  sorts?: { property?: string; timestamp?: string; direction: 'ascending' | 'descending' }[];
  limit: number;
  /** Decoded cursor: skip past rows whose key is <= this. */
  cursor?: { id: string; createdAt: string };
}

interface QueryResult {
  pageRows: (typeof pages.$inferSelect)[];
  hasMore: boolean;
  nextCursor: { id: string; createdAt: string } | null;
}

/** Build a formula evaluation context using `getProperty` per the EvalContext interface. */
function makeFormulaContext(
  pageValues: Map<string, Record<string, unknown>>,
  propByName: Map<string, PropertyDef>,
): EvalContext {
  return {
    getProperty: (name): FormulaValue => {
      const def = propByName.get(name);
      if (!def) return { type: 'string', value: '' };
      const value = pageValues.get(def.id);
      const scalar = scalarOf(value, def.type);
      if (typeof scalar === 'number') return { type: 'number', value: scalar };
      if (typeof scalar === 'boolean') return { type: 'boolean', value: scalar };
      return { type: 'string', value: String(scalar ?? '') };
    },
  };
}

/** Evaluate a formula expression for one page; returns null on any error. */
function evaluateFormulaForPage(
  expression: string,
  pageValues: Map<string, Record<string, unknown>>,
  propByName: Map<string, PropertyDef>,
): FormulaValue | null {
  try {
    return evaluateFormula(expression, makeFormulaContext(pageValues, propByName));
  } catch (err) {
    if (err instanceof FormulaEvalError) return null;
    return null;
  }
}

function evalOps(
  ops: Record<string, unknown>,
  type: string,
  value: Record<string, unknown>,
): boolean {
  const payload = value[type];

  if (type === 'title' || type === 'rich_text') {
    const text = Array.isArray(payload)
      ? (payload as Array<{ plain_text?: string; text?: { content?: string } }>)
          .map((n) => {
            const pt = n.plain_text;
            if (typeof pt === 'string' && pt.length > 0) return pt;
            return n.text?.content ?? '';
          })
          .join('')
      : '';
    return evalStringOps(ops, text);
  }
  if (type === 'url' || type === 'email' || type === 'phone_number') {
    return evalStringOps(ops, typeof payload === 'string' ? payload : '');
  }

  if (type === 'number') {
    return evalNumberOps(ops, typeof payload === 'number' ? payload : null);
  }
  if (type === 'checkbox') {
    return evalCheckboxOps(ops, payload === true);
  }
  if (type === 'select' || type === 'status') {
    const obj = (payload as { name?: string } | null) ?? null;
    return evalSelectOps(ops, obj?.name ?? null);
  }
  if (type === 'multi_select') {
    const arr = Array.isArray(payload)
      ? (payload as Array<{ name?: string }>).map((o) => o.name ?? '')
      : [];
    return evalMultiSelectOps(ops, arr);
  }
  if (type === 'date' || type === 'created_time' || type === 'last_edited_time') {
    const obj = payload as { start?: string } | null | undefined;
    const start =
      typeof payload === 'string'
        ? payload
        : obj && typeof obj.start === 'string'
          ? obj.start
          : null;
    return evalDateOps(ops, start);
  }
  if (type === 'people' || type === 'created_by' || type === 'last_edited_by') {
    const arr = Array.isArray(payload)
      ? (payload as Array<{ id?: string }>).map((p) => p.id ?? '')
      : payload && typeof payload === 'object' && 'id' in (payload as Record<string, unknown>)
        ? [(payload as { id: string }).id]
        : [];
    return evalContainsOps(ops, arr);
  }
  if (type === 'files') {
    const arr = Array.isArray(payload) ? payload : [];
    if ('is_empty' in ops && ops['is_empty'] === true) return arr.length === 0;
    if ('is_not_empty' in ops && ops['is_not_empty'] === true) return arr.length > 0;
    return false;
  }
  if (type === 'relation') {
    const arr = Array.isArray(payload)
      ? (payload as Array<{ id?: string }>).map((p) => p.id ?? '')
      : [];
    return evalContainsOps(ops, arr);
  }
  if (type === 'rollup') {
    // Rollup evaluation requires resolving the relation + walking the target
    // database; deferred to v1.1 alongside the rollup engine.
    if ('is_empty' in ops) return true;
    return false;
  }
  return false;
}

function evalStringOps(ops: Record<string, unknown>, text: string): boolean {
  const lc = text.toLocaleLowerCase();
  if ('equals' in ops) return text === ops['equals'];
  if ('does_not_equal' in ops) return text !== ops['does_not_equal'];
  if ('contains' in ops) return lc.includes(String(ops['contains']).toLocaleLowerCase());
  if ('does_not_contain' in ops)
    return !lc.includes(String(ops['does_not_contain']).toLocaleLowerCase());
  if ('starts_with' in ops) return lc.startsWith(String(ops['starts_with']).toLocaleLowerCase());
  if ('ends_with' in ops) return lc.endsWith(String(ops['ends_with']).toLocaleLowerCase());
  if ('is_empty' in ops && ops['is_empty'] === true) return text.length === 0;
  if ('is_not_empty' in ops && ops['is_not_empty'] === true) return text.length > 0;
  return false;
}

function evalNumberOps(ops: Record<string, unknown>, n: number | null): boolean {
  if ('is_empty' in ops && ops['is_empty'] === true) return n === null;
  if ('is_not_empty' in ops && ops['is_not_empty'] === true) return n !== null;
  if (n === null) return false;
  if ('equals' in ops) return n === ops['equals'];
  if ('does_not_equal' in ops) return n !== ops['does_not_equal'];
  if ('greater_than' in ops) return n > (ops['greater_than'] as number);
  if ('less_than' in ops) return n < (ops['less_than'] as number);
  if ('greater_than_or_equal_to' in ops) return n >= (ops['greater_than_or_equal_to'] as number);
  if ('less_than_or_equal_to' in ops) return n <= (ops['less_than_or_equal_to'] as number);
  return false;
}

function evalCheckboxOps(ops: Record<string, unknown>, b: boolean): boolean {
  if ('equals' in ops) return b === ops['equals'];
  if ('does_not_equal' in ops) return b !== ops['does_not_equal'];
  return false;
}

function evalSelectOps(ops: Record<string, unknown>, name: string | null): boolean {
  if ('is_empty' in ops && ops['is_empty'] === true) return name === null;
  if ('is_not_empty' in ops && ops['is_not_empty'] === true) return name !== null;
  if (name === null) return false;
  if ('equals' in ops) return name === ops['equals'];
  if ('does_not_equal' in ops) return name !== ops['does_not_equal'];
  return false;
}

function evalMultiSelectOps(ops: Record<string, unknown>, names: string[]): boolean {
  if ('is_empty' in ops && ops['is_empty'] === true) return names.length === 0;
  if ('is_not_empty' in ops && ops['is_not_empty'] === true) return names.length > 0;
  if ('contains' in ops) return names.includes(String(ops['contains']));
  if ('does_not_contain' in ops) return !names.includes(String(ops['does_not_contain']));
  return false;
}

function evalDateOps(ops: Record<string, unknown>, dateStr: string | null): boolean {
  if ('is_empty' in ops && ops['is_empty'] === true) return dateStr === null;
  if ('is_not_empty' in ops && ops['is_not_empty'] === true) return dateStr !== null;
  if (dateStr === null) return false;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  if ('equals' in ops) return d === new Date(String(ops['equals'])).getTime();
  if ('before' in ops) return d < new Date(String(ops['before'])).getTime();
  if ('after' in ops) return d > new Date(String(ops['after'])).getTime();
  if ('on_or_before' in ops) return d <= new Date(String(ops['on_or_before'])).getTime();
  if ('on_or_after' in ops) return d >= new Date(String(ops['on_or_after'])).getTime();
  const now = Date.now();
  const day = 86_400_000;
  if ('past_week' in ops) return d >= now - 7 * day && d <= now;
  if ('past_month' in ops) return d >= now - 30 * day && d <= now;
  if ('past_year' in ops) return d >= now - 365 * day && d <= now;
  if ('next_week' in ops) return d >= now && d <= now + 7 * day;
  if ('next_month' in ops) return d >= now && d <= now + 30 * day;
  if ('next_year' in ops) return d >= now && d <= now + 365 * day;
  if ('this_week' in ops) return d >= now - 7 * day && d <= now + 7 * day;
  return false;
}

function evalContainsOps(ops: Record<string, unknown>, ids: string[]): boolean {
  if ('is_empty' in ops && ops['is_empty'] === true) return ids.length === 0;
  if ('is_not_empty' in ops && ops['is_not_empty'] === true) return ids.length > 0;
  if ('contains' in ops) return ids.includes(String(ops['contains']));
  if ('does_not_contain' in ops) return !ids.includes(String(ops['does_not_contain']));
  return false;
}

/** Apply a formula filter (filter shape: `{ property, formula: { string?|number?|checkbox?|date? } }`). */
function evalFormulaFilter(
  formulaOps: Record<string, unknown>,
  def: PropertyDef,
  values: Map<string, Record<string, unknown>>,
  propByName: Map<string, PropertyDef>,
): boolean {
  const expression = def.config?.['expression'];
  if (typeof expression !== 'string' || expression.length === 0) {
    return 'is_empty' in formulaOps;
  }
  const result = evaluateFormulaForPage(expression, values, propByName);
  if (result === null) {
    return 'is_empty' in formulaOps;
  }
  // FormulaValue is one of: { type: 'string'|'number'|'boolean', value }.
  if (typeof formulaOps['string'] === 'object' && formulaOps['string'] !== null) {
    const text =
      result.type === 'string'
        ? result.value
        : result.type === 'number'
          ? String(result.value)
          : result.value
            ? 'true'
            : 'false';
    return evalStringOps(formulaOps['string'] as Record<string, unknown>, text);
  }
  if (typeof formulaOps['number'] === 'object' && formulaOps['number'] !== null) {
    const n =
      result.type === 'number'
        ? result.value
        : result.type === 'boolean'
          ? result.value
            ? 1
            : 0
          : Number(result.value);
    return evalNumberOps(
      formulaOps['number'] as Record<string, unknown>,
      Number.isFinite(n) ? n : null,
    );
  }
  if (typeof formulaOps['checkbox'] === 'object' && formulaOps['checkbox'] !== null) {
    const b =
      result.type === 'boolean'
        ? result.value
        : result.type === 'number'
          ? result.value !== 0
          : (result.value as string).length > 0;
    return evalCheckboxOps(formulaOps['checkbox'] as Record<string, unknown>, b);
  }
  if (typeof formulaOps['date'] === 'object' && formulaOps['date'] !== null) {
    // Notion's documented semantics: formula filters tagged `date` evaluate the
    // formula expression and treat a string-typed result as an ISO date string.
    // FormulaValue does not carry a 'date' variant, so non-string results yield null.
    const dateStr = result.type === 'string' ? result.value : null;
    return evalDateOps(formulaOps['date'] as Record<string, unknown>, dateStr);
  }
  if ('is_empty' in formulaOps && formulaOps['is_empty'] === true) {
    if (result.type === 'string') return result.value.length === 0;
    if (result.type === 'number') return result.value === 0;
    return !result.value;
  }
  if ('is_not_empty' in formulaOps && formulaOps['is_not_empty'] === true) {
    if (result.type === 'string') return result.value.length > 0;
    if (result.type === 'number') return result.value !== 0;
    return Boolean(result.value);
  }
  return false;
}

/** Apply a rollup filter by evaluating the rollup live against the source page. */
async function evalRollupFilter(
  db: Database,
  rollupOps: Record<string, unknown>,
  def: PropertyDef,
  sourcePageId: string,
): Promise<boolean> {
  const config = (def.config ?? {}) as {
    relation_property_id?: string;
    rollup_property_id?: string;
    function?: string;
  };
  if (
    typeof config.relation_property_id !== 'string' ||
    typeof config.rollup_property_id !== 'string' ||
    typeof config.function !== 'string'
  ) {
    return 'is_empty' in rollupOps;
  }
  let result: RollupValue;
  try {
    result = await evaluateRollup(db, {
      sourcePageId,
      relationPropertyId: config.relation_property_id,
      rollupPropertyId: config.rollup_property_id,
      function: config.function,
    });
  } catch {
    return 'is_empty' in rollupOps;
  }
  if (typeof rollupOps['number'] === 'object' && rollupOps['number'] !== null) {
    const n = result.type === 'number' ? result.number : null;
    return evalNumberOps(rollupOps['number'] as Record<string, unknown>, n);
  }
  if (typeof rollupOps['date'] === 'object' && rollupOps['date'] !== null) {
    const dateStr = result.type === 'date' ? (result.date?.start ?? null) : null;
    return evalDateOps(rollupOps['date'] as Record<string, unknown>, dateStr);
  }
  // any/every/none on array rollups are a v1.1 deferred feature.
  return false;
}

/** Evaluate a filter tree against a single page given its property values + meta. */
async function evalFilter(
  db: Database,
  filter: unknown,
  values: Map<string, Record<string, unknown>>,
  propByName: Map<string, PropertyDef>,
  pageId: string,
): Promise<boolean> {
  if (filter === null || typeof filter !== 'object') return true;
  const obj = filter as Record<string, unknown>;
  if (Array.isArray(obj['and'])) {
    for (const sub of obj['and'] as unknown[]) {
      if (!(await evalFilter(db, sub, values, propByName, pageId))) return false;
    }
    return true;
  }
  if (Array.isArray(obj['or'])) {
    for (const sub of obj['or'] as unknown[]) {
      if (await evalFilter(db, sub, values, propByName, pageId)) return true;
    }
    return false;
  }
  const propName = obj['property'] as string;
  const def = propByName.get(propName);
  if (!def) throw new UnknownPropertyError(propName);
  if (def.type === 'formula') {
    return evalFormulaFilter(
      (obj[def.type] as Record<string, unknown>) ?? {},
      def,
      values,
      propByName,
    );
  }
  if (def.type === 'rollup') {
    return evalRollupFilter(db, (obj[def.type] as Record<string, unknown>) ?? {}, def, pageId);
  }
  const value = values.get(def.id);
  if (!value) {
    return evalOps((obj[def.type] as Record<string, unknown>) ?? {}, def.type, {
      [def.type]: null,
    } as Record<string, unknown>);
  }
  return evalOps((obj[def.type] as Record<string, unknown>) ?? {}, def.type, value);
}

/** Pre-walk: verify every `property` reference in the filter tree exists. */
function validateFilterProperties(filter: unknown, propByName: Map<string, PropertyDef>): void {
  if (filter === null || typeof filter !== 'object') return;
  const obj = filter as Record<string, unknown>;
  if (Array.isArray(obj['and'])) {
    for (const sub of obj['and'] as unknown[]) validateFilterProperties(sub, propByName);
    return;
  }
  if (Array.isArray(obj['or'])) {
    for (const sub of obj['or'] as unknown[]) validateFilterProperties(sub, propByName);
    return;
  }
  if (typeof obj['property'] === 'string') {
    if (!propByName.has(obj['property'])) {
      throw new UnknownPropertyError(obj['property']);
    }
  }
}

/**
 * Execute a database query: filter + sort + pagination over the rows whose
 * `parent_type='database'` and `parent_id=databaseId`.
 */
export async function queryDatabase(db: Database, args: QueryArgs): Promise<QueryResult> {
  // Load schema.
  const props = await db
    .select()
    .from(databaseProperties)
    .where(eq(databaseProperties.databaseId, args.databaseId));
  const propByName = new Map<string, PropertyDef>(
    props.map((p) => [
      p.name,
      {
        id: p.id,
        name: p.name,
        type: p.type,
        config: (p.config ?? null) as Record<string, unknown> | null,
      },
    ]),
  );

  if (args.filter !== undefined && args.filter !== null) {
    validateFilterProperties(args.filter, propByName);
  }

  // Pull all candidate rows.
  const rows = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.parentId, args.databaseId),
        eq(pages.parentType, 'database'),
        eq(pages.archived, false),
      ),
    )
    .orderBy(asc(pages.createdAt), asc(pages.id));

  const ids = rows.map((r) => r.id);
  const valuesByPage = new Map<string, Map<string, Record<string, unknown>>>();
  if (ids.length > 0) {
    const allValues = await db
      .select()
      .from(pageProperties)
      .where(inArray(pageProperties.pageId, ids));
    for (const v of allValues) {
      let m = valuesByPage.get(v.pageId);
      if (!m) {
        m = new Map();
        valuesByPage.set(v.pageId, m);
      }
      m.set(v.propertyId, v.value as Record<string, unknown>);
    }
  }

  let filtered = rows;
  if (args.filter !== undefined && args.filter !== null) {
    const matches = await Promise.all(
      rows.map(async (row) => {
        const values = valuesByPage.get(row.id) ?? new Map();
        try {
          return await evalFilter(db, args.filter, values, propByName, row.id);
        } catch (err) {
          if (err instanceof UnknownPropertyError) throw err;
          return false;
        }
      }),
    );
    filtered = rows.filter((_, i) => matches[i] === true);
  }

  const sortSpec = args.sorts;
  if (sortSpec !== undefined && sortSpec.length > 0) {
    filtered = [...filtered].sort((a, b) => compareRows(a, b, sortSpec, propByName, valuesByPage));
  }

  if (args.cursor !== undefined) {
    const cur = args.cursor;
    const idx = filtered.findIndex(
      (r) => r.id === cur.id && r.createdAt.toISOString() === cur.createdAt,
    );
    if (idx >= 0) filtered = filtered.slice(idx + 1);
  }

  const window = filtered.slice(0, args.limit);
  const hasMore = filtered.length > args.limit;
  const last = window.at(-1);
  const nextCursor =
    hasMore && last !== undefined ? { id: last.id, createdAt: last.createdAt.toISOString() } : null;

  return { pageRows: window, hasMore, nextCursor };
}

function compareRows(
  a: typeof pages.$inferSelect,
  b: typeof pages.$inferSelect,
  sorts: { property?: string; timestamp?: string; direction: 'ascending' | 'descending' }[],
  propByName: Map<string, PropertyDef>,
  valuesByPage: Map<string, Map<string, Record<string, unknown>>>,
): number {
  for (const s of sorts) {
    const dir = s.direction === 'ascending' ? 1 : -1;
    let av: unknown;
    let bv: unknown;
    if (s.timestamp === 'created_time') {
      av = a.createdAt.getTime();
      bv = b.createdAt.getTime();
    } else if (s.timestamp === 'last_edited_time') {
      av = a.lastEditedAt.getTime();
      bv = b.lastEditedAt.getTime();
    } else if (s.property) {
      const def = propByName.get(s.property);
      if (!def) continue;
      const valuesA = valuesByPage.get(a.id) ?? new Map();
      const valuesB = valuesByPage.get(b.id) ?? new Map();
      if (def.type === 'formula') {
        const expr = def.config?.['expression'];
        if (typeof expr === 'string') {
          const ra = evaluateFormulaForPage(expr, valuesA, propByName);
          const rb = evaluateFormulaForPage(expr, valuesB, propByName);
          av = ra === null ? null : ra.value;
          bv = rb === null ? null : rb.value;
        } else {
          av = null;
          bv = null;
        }
      } else {
        av = scalarOf(valuesA.get(def.id), def.type);
        bv = scalarOf(valuesB.get(def.id), def.type);
      }
    } else {
      continue;
    }
    if (av === undefined || av === null) {
      if (bv === undefined || bv === null) continue;
      return 1; // nulls last
    }
    if (bv === undefined || bv === null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      continue;
    }
    if (typeof av === 'boolean' && typeof bv === 'boolean') {
      if (av === bv) continue;
      return (av ? 1 : -1) * dir;
    }
    const sa = String(av);
    const sb = String(bv);
    const cmp = sa.localeCompare(sb);
    if (cmp !== 0) return cmp * dir;
  }
  // Tie-breaker.
  const cmp = a.createdAt.getTime() - b.createdAt.getTime();
  if (cmp !== 0) return cmp;
  return a.id.localeCompare(b.id);
}

function scalarOf(value: Record<string, unknown> | undefined, type: string): unknown {
  if (!value) return null;
  const v = value[type];
  if (type === 'title' || type === 'rich_text') {
    return Array.isArray(v)
      ? (v as Array<{ plain_text?: string; text?: { content?: string } }>)
          .map((n) => {
            const pt = n.plain_text;
            if (typeof pt === 'string' && pt.length > 0) return pt;
            return n.text?.content ?? '';
          })
          .join('')
      : '';
  }
  if (type === 'number' || type === 'checkbox') return v ?? null;
  if (type === 'select' || type === 'status') return (v as { name?: string } | null)?.name ?? null;
  if (type === 'date') return (v as { start?: string } | null)?.start ?? null;
  if (type === 'created_time' || type === 'last_edited_time') return v ?? null;
  return null;
}
