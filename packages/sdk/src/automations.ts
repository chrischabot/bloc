import type { BlocClient } from './client.ts';

export interface AutomationRunResponse {
  object: 'automation_run';
  id: string;
  status: 'success' | 'partial' | 'failed';
  steps: Array<{
    index: number;
    type: string;
    status: 'success' | 'failed' | 'skipped';
    duration_ms: number;
    output?: unknown;
    error?: string;
  }>;
  started_at: string;
  ended_at: string | null;
}

export interface AutomationObject {
  object: 'automation';
  id: string;
  database_id: string;
  name: string;
  enabled: boolean;
  trigger: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  last_run_at: string | null;
  runs_count: number;
  created_time: string;
  last_edited_time: string;
}

export class ButtonsNamespace {
  constructor(private readonly client: BlocClient) {}

  invoke(args: {
    block_id: string;
    context?: Record<string, unknown>;
  }): Promise<AutomationRunResponse> {
    return this.client.request<AutomationRunResponse>({
      method: 'POST',
      path: `/v1/buttons/${args.block_id}/invoke`,
      body: args.context !== undefined ? { context: args.context } : undefined,
    });
  }
}

export class AutomationsNamespace {
  constructor(private readonly client: BlocClient) {}

  list(args: { database_id: string }): Promise<{
    object: 'list';
    type: 'automation';
    results: AutomationObject[];
    next_cursor: string | null;
    has_more: boolean;
  }> {
    return this.client.request({
      method: 'GET',
      path: `/v1/databases/${args.database_id}/automations`,
    });
  }

  create(args: {
    database_id: string;
    name: string;
    trigger: Record<string, unknown>;
    steps: Array<Record<string, unknown>>;
    enabled?: boolean;
  }): Promise<AutomationObject> {
    const { database_id, ...rest } = args;
    return this.client.request({
      method: 'POST',
      path: `/v1/databases/${database_id}/automations`,
      body: rest,
    });
  }

  update(
    args: { automation_id: string } & Partial<{
      name: string;
      trigger: Record<string, unknown>;
      steps: Array<Record<string, unknown>>;
      enabled: boolean;
    }>,
  ): Promise<AutomationObject> {
    const { automation_id, ...rest } = args;
    return this.client.request({
      method: 'PATCH',
      path: `/v1/automations/${automation_id}`,
      body: rest,
    });
  }

  delete(args: { automation_id: string }): Promise<void> {
    return this.client.request({
      method: 'DELETE',
      path: `/v1/automations/${args.automation_id}`,
    });
  }

  test(args: {
    automation_id: string;
    sample_page_id?: string;
    context?: Record<string, unknown>;
  }): Promise<AutomationRunResponse> {
    const { automation_id, ...rest } = args;
    return this.client.request({
      method: 'POST',
      path: `/v1/automations/${automation_id}/runs:test`,
      body: rest,
    });
  }
}
