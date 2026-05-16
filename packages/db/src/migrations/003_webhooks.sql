-- Phase 21 — Webhooks

CREATE TABLE webhooks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration_id     uuid,
  owner_user_id      uuid NOT NULL REFERENCES users(id),
  endpoint_url       text NOT NULL,
  signing_secret     text NOT NULL,
  subscribed_events  jsonb NOT NULL DEFAULT '[]'::jsonb,
  filter             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status             text NOT NULL DEFAULT 'unverified',
  failure_streak     integer NOT NULL DEFAULT 0,
  enabled            boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_workspace ON webhooks (workspace_id);

CREATE TABLE webhook_deliveries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL,
  event_type    text NOT NULL,
  status        text NOT NULL,
  http_status   integer,
  attempt       integer NOT NULL DEFAULT 1,
  latency_ms    integer,
  request_body  jsonb NOT NULL,
  response_body text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries (webhook_id);