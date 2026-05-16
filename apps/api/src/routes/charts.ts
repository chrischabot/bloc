import { type ClientHandle, evaluateChart, getDatabase, requirePermission } from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { ChartConfigSchema, BlocNotFoundError } from '@bloc/shared';
import { Hono } from 'hono';
import '../types.ts';

interface Deps {
  handle: ClientHandle;
}

export function createChartsRouter(deps: Deps): Hono {
  const router = new Hono();

  router.post('/evaluate', async (c) => {
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = ChartConfigSchema.parse(await c.req.json());
    return withSpan(
      'charts',
      `charts.evaluate.${body.kind}`,
      {
        'chart.kind': body.kind,
        'chart.database_id': body.data_source.database_id,
        'chart.aggregation': body.data_source.aggregation,
      },
      async () => {
        const db = await getDatabase(deps.handle.db, body.data_source.database_id);
        if (db === null) {
          throw new BlocNotFoundError(
            `Database ${body.data_source.database_id} not found`,
            requestId,
          );
        }
        await requirePermission(
          deps.handle.db,
          actor,
          { type: 'database', id: body.data_source.database_id },
          'can_read',
        );
        const result = await evaluateChart(deps.handle.db, body);
        return c.json(result);
      },
    );
  });

  return router;
}
