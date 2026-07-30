-- Demo-friendly permissions for the loan application flow.
-- These policies allow anonymous visitors and authenticated users to insert/update/select rows in applications.

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_select_applications" ON public.applications;
DROP POLICY IF EXISTS "authenticated_can_insert_applications" ON public.applications;
DROP POLICY IF EXISTS "allow_anon_insert_applications" ON public.applications;
DROP POLICY IF EXISTS "allow_authenticated_insert_applications" ON public.applications;

CREATE POLICY "allow_anon_insert_applications"
  ON public.applications
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "allow_anon_update_applications"
  ON public.applications
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_authenticated_insert_applications"
  ON public.applications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "allow_authenticated_update_applications"
  ON public.applications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_authenticated_select_applications"
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (true);

GRANT INSERT ON public.applications TO anon;
GRANT UPDATE ON public.applications TO anon;
GRANT SELECT ON public.applications TO anon;

GRANT INSERT ON public.applications TO authenticated;
GRANT UPDATE ON public.applications TO authenticated;
GRANT SELECT ON public.applications TO authenticated;
