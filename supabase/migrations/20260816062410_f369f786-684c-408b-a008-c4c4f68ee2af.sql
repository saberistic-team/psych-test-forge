-- roles
CREATE TYPE public.app_role AS ENUM ('admin', 'creator');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT,
  org TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  billing_cycle_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- signup trigger: first user = admin, rest = creator
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing INTEGER;
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO existing FROM public.user_roles;
  IF existing = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'creator')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- tests
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  slug TEXT,
  title TEXT NOT NULL,
  spec JSONB NOT NULL,
  access_code TEXT UNIQUE,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT SELECT ON public.tests TO anon;
GRANT ALL ON public.tests TO service_role;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creators manage own tests" ON public.tests FOR ALL TO authenticated
  USING (creator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "anyone reads published tests" ON public.tests FOR SELECT TO anon, authenticated
  USING (published = true AND deleted_at IS NULL);

CREATE TRIGGER tests_touch BEFORE UPDATE ON public.tests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- attempts
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  participant_name TEXT,
  responses JSONB NOT NULL,
  scores JSONB NOT NULL,
  validity JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.attempts TO authenticated;
GRANT SELECT, INSERT ON public.attempts TO anon;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creators read attempts on own tests" ON public.attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.tests t WHERE t.id = attempts.test_id AND t.creator_id = auth.uid()));

-- premium reports
CREATE TABLE public.premium_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts ON DELETE CASCADE,
  purchased BOOLEAN NOT NULL DEFAULT false,
  amount NUMERIC(10,2),
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id)
);
GRANT SELECT ON public.premium_reports TO authenticated, anon;
GRANT ALL ON public.premium_reports TO service_role;
ALTER TABLE public.premium_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read reports" ON public.premium_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- generation jobs
CREATE TABLE public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  request TEXT NOT NULL,
  path_hint TEXT NOT NULL DEFAULT 'auto',
  model TEXT NOT NULL,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  status TEXT NOT NULL DEFAULT 'running',
  errors JSONB,
  test_id UUID REFERENCES public.tests ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.generation_jobs TO authenticated;
GRANT ALL ON public.generation_jobs TO service_role;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creators manage own jobs" ON public.generation_jobs FOR ALL TO authenticated
  USING (creator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (creator_id = auth.uid());

CREATE TRIGGER jobs_touch BEFORE UPDATE ON public.generation_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- usage metering
CREATE TABLE public.usage_metering (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  UNIQUE (creator_id, metric, period)
);
GRANT SELECT ON public.usage_metering TO authenticated;
GRANT ALL ON public.usage_metering TO service_role;
ALTER TABLE public.usage_metering ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creators read own usage" ON public.usage_metering FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  participant_id TEXT,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  provider_ref TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscriptions read" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- pricing matrix
CREATE TABLE public.pricing (
  plan TEXT PRIMARY KEY,
  audience TEXT NOT NULL DEFAULT 'creator',
  price_cents INTEGER NOT NULL DEFAULT 0,
  monthly_generations INTEGER,
  monthly_attempts INTEGER,
  can_publish BOOLEAN NOT NULL DEFAULT false,
  pdf_export BOOLEAN NOT NULL DEFAULT false,
  white_label BOOLEAN NOT NULL DEFAULT false,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.pricing TO anon, authenticated;
GRANT ALL ON public.pricing TO service_role;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing public read" ON public.pricing FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write pricing" ON public.pricing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.pricing (plan, audience, price_cents, monthly_generations, monthly_attempts, can_publish, pdf_export, white_label, features, sort_order) VALUES
('free', 'creator', 0, 2, 5, false, false, false, '["2 AI generations / month","Drafts only — publishing locked","Watermarked results","5 participant attempts / month","Community attribution"]', 1),
('pro', 'creator', 1900, 50, 500, true, true, false, '["50 AI generations / month","Publish unlimited tests","500 attempts / month","PDF report export","Custom branding","Priority generation queue"]', 2),
('business', 'creator', 7900, NULL, 10000, true, true, true, '["Unlimited AI generations","10,000 attempts / month","Full white-label","5 team seats","License-clearance advice","CSV / API export"]', 3),
('results_plus', 'participant', 900, NULL, NULL, false, true, false, '["Unlimited premium reports","Full score history + trends","Unlimited retakes","Early access to new tests"]', 4);