-- admin.sql
-- Schema for admin-related tables, links, permissions, logs, and viewer access.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS admin_links (
  id uuid PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  token_hash text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS admin_link_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES admin_links(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_address text
);

CREATE TABLE IF NOT EXISTS admin_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_links_admin_id ON admin_links (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_links_token_hash ON admin_links (token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_link_usages_link_id ON admin_link_usages (link_id);
CREATE INDEX IF NOT EXISTS idx_admin_change_logs_admin_id ON admin_change_logs (admin_id);
