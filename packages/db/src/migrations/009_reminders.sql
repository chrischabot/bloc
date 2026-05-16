-- Phase 17 — Reminders

CREATE TABLE reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_type   text NOT NULL CHECK (parent_type IN ('page','block')),
  parent_id     uuid NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_at        timestamptz NOT NULL,
  label         text,
  fired         boolean NOT NULL DEFAULT false,
  fired_at      timestamptz,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_user_due ON reminders (user_id, due_at);
CREATE INDEX idx_reminders_due ON reminders (due_at);