-- Demo-friendly permissions for the loan application flow.
-- This keeps the flow simple for anonymous applicants while still allowing the admin dashboard to read the same rows.

ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_links DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.applications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.applications TO authenticated;
