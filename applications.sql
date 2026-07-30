-- applications.sql
-- Schema for the applications table used by the loan application form.

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

CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications ("submittedAt" DESC);

ALTER TABLE IF EXISTS applications DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON applications TO anon;
GRANT SELECT, INSERT, UPDATE ON applications TO authenticated;
