-- Phase 19 — Sites & Publications

CREATE TABLE custom_domains (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain        text NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','provisioning','live','failed')),
  tls_cert_arn  text,
  dns_records   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_custom_domains_domain ON custom_domains (domain);
CREATE INDEX idx_custom_domains_workspace ON custom_domains (workspace_id);

CREATE TABLE publications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id           uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  state             text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','live','expired')),
  slug              text NOT NULL,
  custom_domain_id  uuid REFERENCES custom_domains(id) ON DELETE SET NULL,
  allow_edit        boolean NOT NULL DEFAULT false,
  allow_comment     boolean NOT NULL DEFAULT true,
  allow_duplicate   boolean NOT NULL DEFAULT false,
  index_in_search   boolean NOT NULL DEFAULT true,
  show_toc          boolean NOT NULL DEFAULT true,
  show_navbar       boolean NOT NULL DEFAULT true,
  password_hash     text,
  expires_at        timestamptz,
  created_by        uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_publications_page ON publications (page_id);
CREATE INDEX idx_publications_slug ON publications (slug);