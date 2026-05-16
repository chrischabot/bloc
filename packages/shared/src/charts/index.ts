import { z } from 'zod';

export const CHART_KINDS = ['bar', 'line', 'area', 'scatter', 'pie', 'donut', 'number'] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

export const AGGREGATION_FUNCTIONS = [
  'count',
  'count_values',
  'sum',
  'average',
  'median',
  'min',
  'max',
  'unique',
  'percent_empty',
  'percent_not_empty',
] as const;
export type AggregationFunction = (typeof AGGREGATION_FUNCTIONS)[number];

/** Chart data source: which database, which columns, which aggregation. */
export const ChartDataSourceSchema = z
  .object({
    database_id: z.string().uuid(),
    /** Property name used to bucket the x-axis (e.g. 'Status'). Omit for `number` kind. */
    x_property: z.string().min(1).optional(),
    /** Property to aggregate on the y-axis. */
    y_property: z.string().min(1).optional(),
    /** Aggregation function applied to y. */
    aggregation: z.enum(AGGREGATION_FUNCTIONS).default('count'),
    /** Optional second-level grouping for stacked/multi-series charts. */
    group_by: z.string().min(1).optional(),
    /** Optional pre-filter on the database. */
    filter: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type ChartDataSource = z.infer<typeof ChartDataSourceSchema>;

/** Visual config. */
export const ChartStyleSchema = z
  .object({
    palette: z.array(z.string()).max(20).default([]),
    title: z.string().max(120).default(''),
    description: z.string().max(500).default(''),
    legend: z.boolean().default(true),
    show_grid: z.boolean().default(true),
    show_data_labels: z.boolean().default(false),
    stacked: z.boolean().default(false),
  })
  .strict();
export type ChartStyle = z.infer<typeof ChartStyleSchema>;

export const ChartConfigSchema = z
  .object({
    kind: z.enum(CHART_KINDS),
    data_source: ChartDataSourceSchema,
    style: ChartStyleSchema.default({
      palette: [],
      title: '',
      description: '',
      legend: true,
      show_grid: true,
      show_data_labels: false,
      stacked: false,
    }),
  })
  .strict();
export type ChartConfig = z.infer<typeof ChartConfigSchema>;

/** Chart engine output: a series-shaped representation suitable for rendering. */
export interface ChartSeries {
  name: string;
  /** Hex color (defaults to palette index when omitted by caller). */
  color?: string;
  values: Array<number | null>;
}

export interface ChartResult {
  object: 'chart_result';
  kind: ChartKind;
  /** X-axis labels (for non-`number` charts). */
  x_values: string[];
  series: ChartSeries[];
  /** For `number` kind: the single scalar. */
  scalar?: number | null;
  /** Total rows considered. */
  total: number;
  /** ISO timestamp the result was computed. */
  computed_at: string;
}
