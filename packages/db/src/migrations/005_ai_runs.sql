-- Phase 18 — AI run accounting

CREATE TABLE ai_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id),
  surface         text NOT NULL,
  model           text NOT NULL,
  prompt_hash     text NOT NULL,
  tokens_in       integer NOT NULL DEFAULT 0,
  tokens_out      integer NOT NULL DEFAULT 0,
  cost_usd_micro  integer NOT NULL DEFAULT 0,
  latency_ms      integer NOT NULL DEFAULT 0,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_runs_workspace ON ai_runs (workspace_id, created_at DESC);