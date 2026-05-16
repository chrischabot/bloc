import {
  type ClientHandle,
  getBlock,
  getButtonByBlock,
  recordRun,
  requirePermission,
} from '@bloc/db';
import { withSpan } from '@bloc/observability';
import { BlocNotFoundError } from '@bloc/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import '../types.ts';
import { executeSteps } from '../automations/executor.ts';
import { type Emitter, makeEmitter } from '../webhooks/emit.ts';

interface Deps {
  handle: ClientHandle;
  emit?: Emitter;
}

const InvokeSchema = z
  .object({
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export function createButtonsRouter(deps: Deps): Hono {
  const router = new Hono();
  const emit = deps.emit ?? makeEmitter(deps.handle);

  router.post('/:id/invoke', async (c) => {
    const blockId = c.req.param('id');
    const requestId = c.get('requestId');
    const actor = c.get('actor');
    const body = InvokeSchema.parse(await c.req.json().catch(() => ({})));

    return withSpan('buttons', 'buttons.invoke', { 'block.id': blockId }, async () => {
      const block = await getBlock(deps.handle.db, blockId);
      if (block === null) throw new BlocNotFoundError(`Block ${blockId} not found`, requestId);
      if (block.type !== 'button') {
        throw new BlocNotFoundError(`Block ${blockId} is not a button`, requestId);
      }
      const button = await getButtonByBlock(deps.handle.db, blockId);
      if (button === null) {
        // Buttons may also be stored inline in block.content. Fall through to content.steps.
      }
      const steps =
        (button?.steps as unknown[] | undefined) ??
        (
          (block.content as Record<string, unknown>)?.['button'] as
            | { steps?: unknown[] }
            | undefined
        )?.steps ??
        [];

      await requirePermission(
        deps.handle.db,
        actor,
        { type: 'page', id: block.parentType === 'page' ? block.parentId : block.workspaceId },
        'can_edit',
      );

      const bag = {
        actor: { id: actor.userId, workspaceId: actor.workspaceId },
        now: new Date().toISOString(),
        block: { id: blockId },
        ...(body.context ?? {}),
      } as Record<string, unknown>;

      const result = await executeSteps(steps, {
        handle: deps.handle,
        actor,
        bag,
      });

      const run = await recordRun(deps.handle.db, {
        buttonBlockId: blockId,
        status: result.status,
        stepsLog: result.steps_log,
      });

      await emit({
        workspaceId: actor.workspaceId,
        type: 'automation.run.completed',
        data: {
          run_id: run.id,
          button_block_id: blockId,
          status: result.status,
        },
      });

      return c.json({
        object: 'automation_run',
        id: run.id,
        button_block_id: blockId,
        status: result.status,
        steps: result.steps_log,
        started_at: run.startedAt.toISOString(),
        ended_at: run.endedAt?.toISOString() ?? null,
      });
    });
  });

  return router;
}
