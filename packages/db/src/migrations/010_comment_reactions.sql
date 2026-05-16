-- Phase 11.3 — Comment reactions

CREATE TABLE comment_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comment_reactions_comment ON comment_reactions (comment_id);
CREATE UNIQUE INDEX uniq_comment_reaction ON comment_reactions (comment_id, user_id, emoji);