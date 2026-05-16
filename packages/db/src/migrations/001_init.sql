-- Phase 1 initial schema — see docs/architecture/03-data-model.md
-- Note: PGlite does not ship citext; we use text + lower() unique index for email.
-- `gen_random_uuid()` is in core Postgres since 13; no extension needed.

CREATE TABLE workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  icon        text,
  domain      text UNIQUE,
  plan        text NOT NULL DEFAULT 'free',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text,
  avatar_url    text,
  type          text NOT NULL DEFAULT 'person' CHECK (type IN ('person','bot')),
  bot_owner_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_idx ON users (lower(email));

CREATE TABLE workspace_members (
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role          text NOT NULL CHECK (role IN ('owner','membership_admin','member','restricted_member','guest')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE sessions (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  user_agent  text,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  owner_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  token_hash      text NOT NULL,
  token_prefix    text NOT NULL,
  capabilities    text NOT NULL DEFAULT '[]',
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integrations_prefix ON integrations (token_prefix);

CREATE TABLE pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  parent_type     text NOT NULL CHECK (parent_type IN ('workspace','page','database')),
  parent_id       uuid,
  data_source_id  uuid,
  archived        boolean NOT NULL DEFAULT false,
  in_trash        boolean NOT NULL DEFAULT false,
  is_template     boolean NOT NULL DEFAULT false,
  is_wiki         boolean NOT NULL DEFAULT false,
  public_slug     text,
  cover           jsonb,
  icon            jsonb,
  created_by      uuid NOT NULL REFERENCES users(id),
  last_edited_by  uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_edited_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pages_workspace_parent ON pages (workspace_id, parent_id);
CREATE INDEX idx_pages_workspace_edit ON pages (workspace_id, archived, last_edited_at DESC);
CREATE INDEX idx_pages_data_source ON pages (data_source_id);

CREATE TABLE databases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  parent_type     text NOT NULL,
  parent_id       uuid,
  title           jsonb NOT NULL DEFAULT '[]'::jsonb,
  description     jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_inline       boolean NOT NULL DEFAULT false,
  archived        boolean NOT NULL DEFAULT false,
  in_trash        boolean NOT NULL DEFAULT false,
  cover           jsonb,
  icon            jsonb,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES users(id),
  last_edited_by  uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_edited_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE data_sources (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id             uuid NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  type                    text NOT NULL DEFAULT 'owned' CHECK (type IN ('owned','linked')),
  source_database_id      uuid,
  source_data_source_id   uuid,
  archived                boolean NOT NULL DEFAULT false,
  position                text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_data_sources_database ON data_sources (database_id);

CREATE TABLE database_properties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id     uuid NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  data_source_id  uuid,
  name            text NOT NULL,
  type            text NOT NULL,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  position        text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (database_id, name)
);
CREATE INDEX idx_database_properties_database ON database_properties (database_id);

CREATE TABLE database_views (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id         uuid NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  data_source_id      uuid,
  name                text NOT NULL,
  type                text NOT NULL,
  filter              jsonb,
  sort                jsonb,
  group_by            jsonb,
  visible_properties  jsonb,
  config              jsonb NOT NULL DEFAULT '{}'::jsonb,
  position            text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_database_views_database ON database_views (database_id);

CREATE TABLE blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  parent_type     text NOT NULL CHECK (parent_type IN ('page','block','database')),
  parent_id       uuid NOT NULL,
  position        text NOT NULL,
  type            text NOT NULL,
  content         jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_children    boolean NOT NULL DEFAULT false,
  archived        boolean NOT NULL DEFAULT false,
  version         integer NOT NULL DEFAULT 0,
  created_by      uuid NOT NULL REFERENCES users(id),
  last_edited_by  uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_edited_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blocks_parent ON blocks (parent_id, position);
CREATE INDEX idx_blocks_workspace_type ON blocks (workspace_id, type, last_edited_at DESC);

CREATE TABLE block_updates (
  page_id     uuid NOT NULL,
  clock       bigint NOT NULL,
  update      bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_block_updates_page_clock ON block_updates (page_id, clock);

CREATE TABLE page_properties (
  page_id      uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  property_id  uuid NOT NULL REFERENCES database_properties(id) ON DELETE CASCADE,
  value        jsonb NOT NULL,
  PRIMARY KEY (page_id, property_id)
);
CREATE INDEX idx_page_properties_property ON page_properties (property_id, (value->>'type'));

CREATE TABLE discussions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type  text NOT NULL CHECK (parent_type IN ('page','block')),
  parent_id    uuid NOT NULL,
  resolved     boolean NOT NULL DEFAULT false,
  anchor       jsonb,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_discussions_parent ON discussions (parent_type, parent_id);

CREATE TABLE comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id   uuid NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  parent_type     text NOT NULL,
  parent_id       uuid NOT NULL,
  rich_text       jsonb NOT NULL,
  created_by      uuid NOT NULL REFERENCES users(id),
  last_edited_by  uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_edited_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_discussion ON comments (discussion_id);

CREATE TABLE files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  uploaded_by     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  size_bytes      bigint NOT NULL,
  mime            text NOT NULL,
  storage_key     text NOT NULL,
  url_expires_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type  text NOT NULL CHECK (resource_type IN ('page','database')),
  resource_id    uuid NOT NULL,
  grantee_type   text NOT NULL CHECK (grantee_type IN ('user','workspace','public','link','teamspace','group')),
  grantee_id     uuid,
  level          text NOT NULL CHECK (level IN ('full_access','can_edit','can_edit_content','can_comment','can_read','no_access')),
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_permissions_resource ON permissions (resource_type, resource_id);

CREATE TABLE audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  actor_user_id   uuid,
  action          text NOT NULL,
  resource_type   text,
  resource_id     uuid,
  metadata        jsonb,
  ip              inet,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_workspace_created ON audit_events (workspace_id, created_at DESC);