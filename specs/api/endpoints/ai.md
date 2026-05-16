# AI Endpoints

See `docs/frontend/18-ai.md`.

## `POST /v1/ai/completions`

Streaming completion (Server-Sent Events).

**Body**:
```jsonc
{
  "surface": "writer" | "ai_block" | "agent" | "autofill" | "qa",
  "model": "default" | "fast" | "advanced",
  "messages": [
    { "role": "system", "content": "You are…" },
    { "role": "user",   "content": "..." }
  ],
  "context_pages": ["<page-id>"],   // optional grounding; ACL-checked
  "stream": true
}
```

**Response**: SSE stream with events:
- `data: {"type":"token","value":"Hel"}`
- `data: {"type":"token","value":"lo"}`
- `data: {"type":"source","page_id":"...","snippet":"..."}` (for Q&A and grounded calls)
- `data: {"type":"end","run_id":"...","tokens_in":52,"tokens_out":118}`

Errors stream as `data: {"type":"error","code":"...","message":"..."}` followed by stream close.

## `POST /v1/ai/qa`

Synchronous Q&A.

**Body**: `{ "query": "...", "filter": { "object": "page|database", ... } }`.

**Response**:
```jsonc
{
  "object": "ai_answer",
  "answer": "Plain or markdown answer.",
  "sources": [
    { "page_id": "uuid", "snippet": "...", "score": 0.87 }
  ],
  "run_id": "..."
}
```

## Agent

### `POST /v1/ai/agent/tasks`

Create a new task or continue an existing one.

**Body**:
```jsonc
{
  "task_id": "uuid|null",         // null to create
  "user_message": "Plan a launch for the new feature.",
  "allowed_tools": ["pages.search","pages.create","blocks.append","databases.query","comments.create"]
}
```

**Response** (streamed SSE):
- `data: {"type":"assistant_message","content":"..."}`
- `data: {"type":"tool_call","name":"pages.search","input":{...},"call_id":"..."}`
- `data: {"type":"tool_result","call_id":"...","output":{...}}`
- `data: {"type":"end","task_id":"..."}`

### `GET /v1/ai/agent/tasks/{task_id}`

Retrieve task state + history.

### `POST /v1/ai/agent/tasks/{task_id}:cancel`

Cancels a running task.

## `POST /v1/ai/autofill/run`

Run autofill on a specific page property.

**Body**: `{ "page_id":"uuid", "property_id":"uuid" }`.

**Response**: `{ "object":"property_item", ... }` (the updated value).

## Meeting Notes

### `POST /v1/ai/meeting-notes`

Multipart: an audio file + JSON metadata. Returns a job:
```jsonc
{ "object":"meeting_notes_job", "id":"uuid", "page_id":"uuid", "status":"processing" }
```

### `GET /v1/ai/meeting-notes/{job_id}`

```jsonc
{
  "object":"meeting_notes_job",
  "id":"uuid",
  "status":"processing|complete|failed",
  "page_id":"uuid",
  "duration_s":1320,
  "progress":0.6
}
```

When complete, the referenced page contains the rendered Meeting Notes layout (sections: Summary, Key points, Action items, Decisions, Transcript).

## Errors

| HTTP | Code |
|------|------|
| 400 | `invalid_request` (unknown surface, bad model) |
| 402 | `restricted_resource` (plan does not include this AI surface) |
| 403 | `restricted_resource` (Q&A context page not readable) |
| 409 | `conflict_error` (cancelled task continued) |
| 422 | `unprocessable_entity` (audio decode failed) |
| 429 | `rate_limited` (AI quota exhausted) |

## Test obligations

- Contract: each surface's request/response shape; SSE framing.
- Chaos: 10 MB prompts (truncated to 200 KB and warned), audio of 0 bytes / wrong codec / 5h (>4h cap → 413), Q&A query with non-readable context page → 403.
- Observability: every call produces an `ai.<surface>` span + an `ai_runs` row; SSE close on cancel emits a `client_canceled` log.
- Benchmark: Q&A p99 first-token < 800ms; autofill p99 end-to-end < 4s for a typical row.