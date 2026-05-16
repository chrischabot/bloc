-- Phase 22 — Analytics events

CREATE TABLE analytics_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid,
  kind          text NOT NULL CHECK (kind IN ('page_view','web_vital','ui_action')),
  page_id       uuid,
  metric        text,
  value         integer,
  action        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_workspace_created ON analytics_events (workspace_id, created_at DESC);