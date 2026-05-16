# Phase 18 — Notion AI

## Goal

Ship every Notion AI surface end-to-end on top of an interchangeable LLM provider.

## Read first

- `docs/frontend/18-ai.md`
- `docs/api/endpoints/ai.md`

## Deliverables

1. AI provider abstraction in `packages/ai/`:
   - `LLM` interface (`chat`, `chat_stream`, `embed`).
   - Adapters: OpenAI / Anthropic / a stub for tests.
   - Provider chosen at runtime via env (`AI_PROVIDER`); model alias map (`default | fast | advanced`).
2. Writer popover + slash-action; replaces / inserts based on action.
3. AI Block block type + renderer + re-run.
4. Q&A: retrieval over MeiliSearch (or pgvector if introduced) + ACL filter + completion; cites sources.
5. Agent: tool registry, MCP-style messaging loop, per-tool ACL check, cancellable streaming.
6. AI Autofill: per-property config UI + worker job.
7. AI Meeting Notes: upload → transcription (provider-backed) → page render with sections.
8. Token / cost accounting: `ai_runs` row per call; daily aggregates on the workspace.
9. UI quota indicator in Settings → AI; warning at 80%, hard limit at 100%.
10. Tests: SSE framing, streaming cancel, tool-call validator, ACL on Q&A context.

## Todos

- [ ] 18.1 LLM provider abstraction
- [ ] 18.2 Writer
- [ ] 18.3 AI Block
- [ ] 18.4 Q&A retrieval + answer
- [ ] 18.5 Agent loop + tool registry
- [ ] 18.6 AI Autofill
- [ ] 18.7 Meeting Notes (record + upload + transcribe)
- [ ] 18.8 Token / cost accounting + quota UI
- [ ] 18.9 SDK additions
- [ ] 18.10 Contract / SDK / chaos / obs / benchmark green

## Definition of Done

- Universal DoD.
- Stub provider end-to-end test asserts every surface produces a span + `ai_runs` row.
- Q&A test: a page the asker cannot read is **not** cited or quoted in the answer.

## Pitfalls

- SSE through edge proxies: ensure `Cache-Control: no-cache` + `X-Accel-Buffering: no`.
- Agent loop: cap tool-call depth at 25 to prevent runaway loops.
- Autofill cycles: if a property's autofill writes back to another property that itself triggers autofill, the engine must detect and break the cycle.