-- Phase 14 — Buttons & Automations

CREATE TABLE buttons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id    uuid NOT NULL,
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirm     jsonb NOT NULL DEFAULT '{"enabled":false,"message":""}'::jsonb,
  created_by  uuid NOT NULL REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_buttons_block ON buttons (block_id);

CREATE TABLE automations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name        text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  trigger     jsonb NOT NULL,
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  runs_count  integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_automations_database ON automations (database_id);

CREATE TABLE automation_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id     uuid,
  button_block_id   uuid,
  trigger_event_id  text,
  status            text NOT NULL,
  steps_log         jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz
);
CREATE INDEX idx_automation_runs_automation ON automation_runs (automation_id);
CREATE UNIQUE INDEX uniq_automation_runs_idem
  ON automation_runs (automation_id, trigger_event_id)
  WHERE trigger_event_id IS NOT NULL;