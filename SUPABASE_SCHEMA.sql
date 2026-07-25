-- NOTE: This schema is inferred from application backend usage and table names.
-- Local Supabase dump was unavailable due to no running local database connection.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Inferred Supabase schema based on application backend usage
-- Tables: applications, admins, admin_links, admin_link_usages, admin_change_logs

CREATE TABLE IF NOT EXISTS applications (
  id text PRIMARY KEY,
  "submittedAt" timestamptz NOT NULL,
  "loanType" text NOT NULL,
  "loanAmount" numeric NOT NULL DEFAULT 0,
  "loanTerm" text NOT NULL,
  purpose text NOT NULL,
  "firstName" text NOT NULL,
  "lastName" text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  "employmentStatus" text NOT NULL,
  "annualIncome" numeric NOT NULL DEFAULT 0,
  "monthlyPayment" numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pre-Approved',
  "verificationCode" text,
  verification_code text
);

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

CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_links_admin_id ON admin_links (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_links_token_hash ON admin_links (token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_link_usages_link_id ON admin_link_usages (link_id);
CREATE INDEX IF NOT EXISTS idx_admin_change_logs_admin_id ON admin_change_logs (admin_id);
