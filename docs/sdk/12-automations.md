# `bloc.automations` and `bloc.buttons`

REST mapping: [`/v1/databases/{id}/automations`, `/v1/buttons`](../api/endpoints/automations.md).

## Types

```ts
interface AutomationObject {
  object:           'automation';
  id:               string;
  database_id:      string;
  name:             string;
  enabled:          boolean;
  trigger:          Record<string, unknown>;
  steps:            Array<Record<string, unknown>>;
  last_run_at:      string | null;
  runs_count:       number;
  created_time:     string;
  last_edited_time: string;
}

interface AutomationRunResponse {
  object: 'automation_run';
  id:     string;
  status: 'success' | 'partial' | 'failed';
  steps:  Array<{
    index:       number;
    type:        string;
    status:      'success' | 'failed' | 'skipped';
    duration_ms: number;
    output?:     unknown;
    error?:      string;
  }>;
  started_at: string;
  ended_at:   string | null;
}
```

## `bloc.automations.list(args) → Promise<...>`

```ts
args: { database_id: string }
```

## `bloc.automations.create(args) → Promise<AutomationObject>`

```ts
args: {
  database_id: string;
  name:        string;
  trigger:     Record<string, unknown>;
  steps:       Array<Record<string, unknown>>;
  enabled?:    boolean;
}
```

## `bloc.automations.update(args) → Promise<AutomationObject>`

```ts
args: { automation_id: string } & Partial<{
  name:    string;
  trigger: Record<string, unknown>;
  steps:   Array<Record<string, unknown>>;
  enabled: boolean;
}>
```

## `bloc.automations.delete(args) → Promise<void>`

```ts
args: { automation_id: string }
```

## `bloc.automations.test(args) → Promise<AutomationRunResponse>`

```ts
args: {
  automation_id:   string;
  sample_page_id?: string;
  context?:        Record<string, unknown>;
}
```

Test-runs the automation against a sample page without persisting side-effects against the run counter.

## `bloc.buttons.invoke(args) → Promise<AutomationRunResponse>`

```ts
args: { block_id: string; context?: Record<string, unknown> }
```

Invokes the automation behind a button block.
