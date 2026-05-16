import type { AggregationFunction, ChartConfig, ChartResult, ChartSeries } from '@bloc/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from './client.ts';
import { queryDatabase } from './query-engine.ts';
import { databaseProperties, pages } from './schema/pages.ts';
import { pageProperties } from './schema/properties.ts';

const DEFAULT_PALETTE = [
  '#2383E2',
  '#E03E3E',
  '#0F7B6C',
  '#9065B0',
  '#D9730D',
  '#CB912F',
  '#3E68FF',
  '#787774',
];

interface PropertyDef {
  id: string;
  name: string;
  type: string;
}

/** Walk a property value envelope and extract its scalar form for aggregation. */
function scalar(value: unknown, type: string): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const v = (value as Record<string, unknown>)[type];
  if (type === 'title' || type === 'rich_text') {
    if (!Array.isArray(v)) return '';
    return (v as Array<{ plain_text?: string; text?: { content?: string } }>)
      .map((n) => {
        const pt = n.plain_text;
        if (typeof pt === 'string' && pt.length > 0) return pt;
        return n.text?.content ?? '';
      })
      .join('');
  }
  if (type === 'number' || type === 'checkbox') return v ?? null;
  if (type === 'select' || type === 'status') return (v as { name?: string } | null)?.name ?? null;
  if (type === 'multi_select') {
    return Array.isArray(v) ? (v as Array<{ name?: string }>).map((o) => o.name ?? '') : [];
  }
  if (type === 'date') return (v as { start?: string } | null)?.start ?? null;
  if (type === 'created_time' || type === 'last_edited_time') return v ?? null;
  if (type === 'people') {
    return Array.isArray(v) ? (v as Array<{ id?: string }>).map((p) => p.id ?? '') : [];
  }
  return null;
}

function aggregate(values: Array<unknown>, fn: AggregationFunction): number {
  const numbers = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '' && v !== false);
  const total = values.length;
  switch (fn) {
    case 'count':
      return total;
    case 'count_values':
      return nonEmpty.length;
    case 'unique':
      return new Set(values.filter((v) => v !== null && v !== undefined)).size;
    case 'sum':
      return numbers.length === 0 ? 0 : numbers.reduce((a, b) => a + b, 0);
    case 'average':
      return numbers.length === 0 ? 0 : numbers.reduce((a, b) => a + b, 0) / numbers.length;
    case 'median': {
      if (numbers.length === 0) return 0;
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const lower = sorted[mid - 1] ?? sorted[mid] ?? 0;
      const upper = sorted[mid] ?? lower;
      return sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
    }
    case 'min':
      return numbers.length === 0 ? 0 : Math.min(...numbers);
    case 'max':
      return numbers.length === 0 ? 0 : Math.max(...numbers);
    case 'percent_empty':
      return total === 0 ? 0 : (total - nonEmpty.length) / total;
    case 'percent_not_empty':
      return total === 0 ? 0 : nonEmpty.length / total;
    default:
      return 0;
  }
}

/** Resolve a bucket key for grouping. Returns 'No value' when missing. */
function bucketKey(scalarValue: unknown): string {
  if (scalarValue === null || scalarValue === undefined || scalarValue === '') return 'No value';
  if (Array.isArray(scalarValue)) {
    return scalarValue.length === 0 ? 'No value' : scalarValue.join(', ');
  }
  return String(scalarValue);
}

interface BuiltRow {
  pageId: string;
  values: Map<string, Record<string, unknown>>;
}

/**
 * Load rows for the chart engine. If a `filter` is provided, routes through
 * the existing `queryDatabase` so the same filter semantics apply as
 * `POST /v1/databases/:id/query`. Otherwise reads all non-archived rows directly.
 */
async function loadRows(
  db: Database,
  databaseId: string,
  filter: Record<string, unknown> | undefined,
): Promise<{ rows: BuiltRow[]; props: PropertyDef[] }> {
  const propRows = await db
    .select()
    .from(databaseProperties)
    .where(eq(databaseProperties.databaseId, databaseId));
  const props: PropertyDef[] = propRows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
  }));

  let pageIds: string[];
  if (filter !== undefined && filter !== null && Object.keys(filter).length > 0) {
    const result = await queryDatabase(db, {
      databaseId,
      filter,
      limit: 10_000,
    });
    pageIds = result.pageRows.map((p) => p.id);
  } else {
    const pageRows = await db
      .select({ id: pages.id })
      .from(pages)
      .where(
        and(
          eq(pages.parentId, databaseId),
          eq(pages.parentType, 'database'),
          eq(pages.archived, false),
        ),
      );
    pageIds = pageRows.map((p) => p.id);
  }

  if (pageIds.length === 0) return { rows: [], props };

  const valueRows = await db
    .select()
    .from(pageProperties)
    .where(inArray(pageProperties.pageId, pageIds));
  const valuesByPage = new Map<string, Map<string, Record<string, unknown>>>();
  for (const v of valueRows) {
    let m = valuesByPage.get(v.pageId);
    if (!m) {
      m = new Map();
      valuesByPage.set(v.pageId, m);
    }
    m.set(v.propertyId, v.value as Record<string, unknown>);
  }
  const rows: BuiltRow[] = pageIds.map((id) => ({
    pageId: id,
    values: valuesByPage.get(id) ?? new Map(),
  }));
  return { rows, props };
}

export async function evaluateChart(db: Database, config: ChartConfig): Promise<ChartResult> {
  const { rows, props } = await loadRows(
    db,
    config.data_source.database_id,
    config.data_source.filter,
  );
  const propByName = new Map(props.map((p) => [p.name, p]));
  const palette = config.style.palette.length > 0 ? config.style.palette : DEFAULT_PALETTE;
  const now = new Date().toISOString();
  const total = rows.length;

  // number kind: single scalar.
  if (config.kind === 'number') {
    const yProp = config.data_source.y_property
      ? propByName.get(config.data_source.y_property)
      : undefined;
    const yValues = yProp
      ? rows.map((r) => scalar(r.values.get(yProp.id), yProp.type))
      : rows.map(() => 1);
    const scalarValue = aggregate(yValues, config.data_source.aggregation);
    return {
      object: 'chart_result',
      kind: 'number',
      x_values: [],
      series: [],
      scalar: scalarValue,
      total,
      computed_at: now,
    };
  }

  // Group-by kind: bar/line/area/scatter/pie/donut.
  const xProp = config.data_source.x_property
    ? propByName.get(config.data_source.x_property)
    : undefined;
  if (xProp === undefined) {
    return {
      object: 'chart_result',
      kind: config.kind,
      x_values: [],
      series: [],
      total,
      computed_at: now,
    };
  }
  const yProp = config.data_source.y_property
    ? propByName.get(config.data_source.y_property)
    : undefined;
  const groupProp = config.data_source.group_by
    ? propByName.get(config.data_source.group_by)
    : undefined;

  const buckets = new Map<string, Map<string, unknown[]>>();
  const seenSeries = new Set<string>();
  const xBucketOrder: string[] = [];

  for (const row of rows) {
    const xRaw = scalar(row.values.get(xProp.id), xProp.type);
    const xKeys = Array.isArray(xRaw)
      ? (xRaw as string[]).map((v) => bucketKey(v))
      : [bucketKey(xRaw)];
    const yValue = yProp ? scalar(row.values.get(yProp.id), yProp.type) : 1;
    const seriesKey = groupProp
      ? bucketKey(scalar(row.values.get(groupProp.id), groupProp.type))
      : (yProp?.name ?? 'Value');
    seenSeries.add(seriesKey);
    for (const xKey of xKeys) {
      let inner = buckets.get(xKey);
      if (!inner) {
        inner = new Map();
        buckets.set(xKey, inner);
        xBucketOrder.push(xKey);
      }
      const list = inner.get(seriesKey) ?? [];
      list.push(yValue);
      inner.set(seriesKey, list);
    }
  }

  const xs = xBucketOrder.slice();
  if (xs.every((x) => x === 'No value' || /^-?\d+(\.\d+)?$/.test(x))) {
    xs.sort((a, b) => {
      if (a === 'No value') return 1;
      if (b === 'No value') return -1;
      return Number(a) - Number(b);
    });
  }

  const seriesNames = Array.from(seenSeries);
  const series: ChartSeries[] = seriesNames.map((name, idx) => {
    const values = xs.map((x) => {
      const inner = buckets.get(x);
      if (!inner) return null;
      const list = inner.get(name);
      if (list === undefined || list.length === 0) return null;
      return aggregate(list, config.data_source.aggregation);
    });
    return {
      name,
      color: palette[idx % palette.length] ?? '#888888',
      values,
    };
  });

  return {
    object: 'chart_result',
    kind: config.kind,
    x_values: xs,
    series,
    total,
    computed_at: now,
  };
}
