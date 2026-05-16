import type { BlocClient } from './client.ts';

export interface ChartResult {
  object: 'chart_result';
  kind: 'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'donut' | 'number';
  x_values: string[];
  series: Array<{ name: string; color?: string; values: Array<number | null> }>;
  scalar?: number | null;
  total: number;
  computed_at: string;
}

export class ChartsNamespace {
  constructor(private readonly client: BlocClient) {}

  evaluate(config: {
    kind: ChartResult['kind'];
    data_source: {
      database_id: string;
      x_property?: string;
      y_property?: string;
      aggregation?: string;
      group_by?: string;
      filter?: Record<string, unknown>;
    };
    style?: Record<string, unknown>;
  }): Promise<ChartResult> {
    return this.client.request<ChartResult>({
      method: 'POST',
      path: '/v1/charts/evaluate',
      body: config,
    });
  }
}
