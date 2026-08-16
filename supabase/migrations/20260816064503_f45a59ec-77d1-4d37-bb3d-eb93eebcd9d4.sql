-- Replace has_role() calls in policies with inline own-row role lookups so that
-- the SECURITY DEFINER helper no longer needs to be callable by signed-in users.

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "own roles read" ON public.user_roles;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "creators manage own tests" ON public.tests;
CREATE POLICY "creators manage own tests" ON public.tests FOR ALL TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "creators read attempts on own tests" ON public.attempts;
CREATE POLICY "creators read attempts on own tests" ON public.attempts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.tests t WHERE t.id = attempts.test_id AND t.creator_id = auth.uid()));

DROP POLICY IF EXISTS "admins read reports" ON public.premium_reports;
CREATE POLICY "admins read reports" ON public.premium_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

DROP POLICY IF EXISTS "creators manage own jobs" ON public.generation_jobs;
CREATE POLICY "creators manage own jobs" ON public.generation_jobs FOR ALL TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "creators read own usage" ON public.usage_metering;
CREATE POLICY "creators read own usage" ON public.usage_metering FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "own subscriptions read" ON public.subscriptions;
CREATE POLICY "own subscriptions read" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins write pricing" ON public.pricing;
CREATE POLICY "admins write pricing" ON public.pricing FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Signed-in users can no longer execute the SECURITY DEFINER helper.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;