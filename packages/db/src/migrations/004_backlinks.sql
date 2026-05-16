-- Phase 17 — Backlinks

CREATE TABLE backlinks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_page_id   uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id   uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  source_block_id  uuid,
  kind             text NOT NULL CHECK (kind IN ('mention','link_to_page','relation')),
  snippet          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Deduplicate edges, treating NULL source_block_id as a stable sentinel.
CREATE UNIQUE INDEX uniq_backlinks_edge ON backlinks (
  source_page_id,
  target_page_id,
  kind,
  COALESCE(source_block_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
CREATE INDEX idx_backlinks_target ON backlinks (target_page_id);
CREATE INDEX idx_backlinks_source ON backlinks (source_page_id);