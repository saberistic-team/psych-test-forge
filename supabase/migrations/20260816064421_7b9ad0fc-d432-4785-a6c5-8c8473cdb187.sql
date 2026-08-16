-- 1. Remove public/anonymous read access to the tests table (access_code leak).
DROP POLICY IF EXISTS "anyone reads published tests" ON public.tests;
REVOKE SELECT ON public.tests FROM anon;

-- 2. Harden has_role: signed-in callers may only check their own roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not allowed to inspect roles of another user';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;