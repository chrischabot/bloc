# AI

Endpoints under `/v1/ai`. Required scope: `ai`.

These endpoints proxy to the configured LLM provider (`AI_PROVIDER` env). With `AI_PROVIDER=stub`, responses are deterministic — useful in tests.

## Completions

`POST /v1/ai/completions`

```json
{
  "surface": "writer" | "ai_block" | "agent" | "autofill" | "qa",
  "model":   "default" | "fast" | "advanced",
  "messages": [
    { "role": "system" | "user" | "assistant" | "tool", "content": "...", "name": "..." }
  ],
  "context_pages": [ "uuid", "uuid" ],
  "block_id": "uuid"
}
```

`surface` and `model` are optional (default `writer` / `default`). When `block_id` is set **and** `surface == 'ai_block'`, the completion is persisted into the named block.

Response:

```json
{
  "object": "ai_completion",
  "surface": "writer",
  "model": "default",
  "text": "...",
  "tokens_in": 312,
  "tokens_out": 187,
  "citations": [ { "pageId": "uuid", "snippet": "...", "score": 0.81 } ]
}
```

## Q&A

`POST /v1/ai/qa`

```json
{ "query": "Where are the Q3 OKRs?", "filter": { "object": "page" | "database" } }
```

Returns:

```json
{
  "object": "ai_answer",
  "answer": "...",
  "sources": [ { "page_id": "uuid", "snippet": "...", "score": 0.91 } ]
}
```

The retrieval window is scoped to pages the caller can read. Answers are cached per `(workspace, query, index_version)` for 1 h.

## Autofill

`POST /v1/ai/autofill/run`

Fill one property on one page. Used by the Autofill surface in the UI.

```json
{ "page_id": "uuid", "property_id": "...", "instructions": "..." }
```

Returns the updated `PropertyItem`.

## Agent

`POST /v1/ai/agent`

Runs a tool-using agent against the workspace until it answers or hits `max_iterations`.

```json
{
  "goal": "Summarise the latest 5 engineering meeting notes",
  "max_iterations": 10,
  "context_pages": [ "uuid" ]
}
```

Response:

```json
{
  "object": "agent_run",
  "task_id": "uuid",
  "status": "success" | "partial" | "failed",
  "goal": "...",
  "message": "Final answer text",
  "steps": [
    {
      "index": 0,
      "type": "tool_call" | "llm",
      "tool": "search_pages",
      "input": { "query": "..." },
      "output": { ... },
      "status": "success" | "failed",
      "duration_ms": 312
    }
  ]
}
```

Agent runs are long; expect 5–30 s. The endpoint streams nothing — wait for the response.

## Rate limits

The AI endpoints share a tighter bucket (6 burst, 1 sustained/s, 60 s window). See [Rate limiting](../05-rate-limiting.md).
