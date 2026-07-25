-- NOTE: This schema is derived from the actual application backend usage.
-- Supabase Auth is required for admin dashboard access.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Policies for applications realtime subscription from authenticated Supabase users.
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "authenticated_can_select_applications"
  ON applications
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "authenticated_can_insert_applications"
  ON applications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications (submittedAt DESC);
CREATE INDEX IF NOT EXISTS idx_admin_links_admin_id ON admin_links (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_links_token_hash ON admin_links (token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_link_usages_link_id ON admin_link_usages (link_id);
CREATE INDEX IF NOT EXISTS idx_admin_change_logs_admin_id ON admin_change_logs (admin_id);
