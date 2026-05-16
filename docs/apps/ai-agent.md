# AI agent

The agent is a tool-using LLM session that runs against a workspace. Triggered from the **AI** panel → **Agent**, or programmatically:

```ts
const run = await bloc.ai.agent({
  goal: 'Find the last 5 engineering retros and write a digest in #weekly-update',
  max_iterations: 10,
  context_pages: [retrosDBId],
});
```

## How it works

1. The agent receives the goal + context as the seed.
2. Each iteration: the LLM picks a tool, Bloc executes it, the result is fed back into the next LLM step.
3. The loop terminates when the LLM produces an answer or `max_iterations` is reached.
4. Each step is recorded with `type` (`tool_call` or `llm`), `input`, `output`, `status`, `duration_ms`.

## Tools

| Tool | Effect |
|---|---|
| `search` | `/v1/search` with the agent's bearer |
| `retrieve_page` | `/v1/pages/{id}` |
| `list_block_children` | walk a page's blocks |
| `query_database` | `/v1/databases/{id}/query` |
| `create_page` | new page (subject to ACL) |
| `update_property` | patch a property |
| `append_blocks` | append children to a page |
| `chart_evaluate` | `/v1/charts/evaluate` |
| `send_webhook` | `POST` an arbitrary JSON |

Tool surface is configurable per-workspace under **Settings → AI → Agent tools**.

## ACL

The agent runs as the caller. Every tool call goes through the same permission checks as a direct API call. The agent **cannot** escalate — if the caller can't read a page, neither can the agent.

## Custom agents

Workspaces can define custom agents under **Settings → AI → Custom agents**. Each carries:

- A system prompt.
- A subset of tools.
- A scope (workspace / specific databases / specific pages).
- A trigger (manual button, scheduled, on-event).

Custom agents appear in the slash menu and on database row dropdowns.

## Limits

- Iterations: 1–20 (configurable per workspace, default cap 10).
- Per-iteration timeout: 60 s.
- Total wall-clock: 5 min.
- Token budget: 100k input + 20k output per run (default; configurable).
- Concurrent runs per workspace: 5.

Exceeding limits returns `status: 'partial'` with the last good answer.

## Safety

- The agent never sees raw bearer tokens.
- Bloc strips `Authorization` headers from any tool that emits HTTP requests.
- An immutable audit row is written on every run.
