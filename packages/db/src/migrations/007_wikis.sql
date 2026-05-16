-- Phase 16 — Wikis: add a verification info JSON column on pages.

ALTER TABLE pages ADD COLUMN IF NOT EXISTS verification jsonb;
-- (is_wiki already exists from Phase 1.)