-- 1. Listing price + sale mode on tests
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_mode text NOT NULL DEFAULT 'free';
ALTER TABLE public.tests
  ADD CONSTRAINT tests_sale_mode_check CHECK (sale_mode IN ('free','take','results'));
ALTER TABLE public.tests
  ADD CONSTRAINT tests_price_cents_check CHECK (price_cents >= 0 AND price_cents <= 100000);

-- 2. Admin overrides on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_override text,
  ADD COLUMN IF NOT EXISTS revenue_share_bps integer;

-- 3. Platform settings
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read settings" ON public.platform_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
INSERT INTO public.platform_settings (key, value) VALUES ('revenue_share_bps', '2000'::jsonb);

-- 4. Usage grants (admin grants + purchased packs)
CREATE TABLE public.usage_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  amount integer NOT NULL,
  period text,
  source text NOT NULL DEFAULT 'admin',
  note text,
  provider_ref text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.usage_grants
  ADD CONSTRAINT usage_grants_metric_check CHECK (metric IN ('generations','attempts','listings')),
  ADD CONSTRAINT usage_grants_source_check CHECK (source IN ('admin','purchase'));
CREATE UNIQUE INDEX usage_grants_provider_ref_key ON public.usage_grants(provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX usage_grants_creator_idx ON public.usage_grants(creator_id, metric);
GRANT SELECT ON public.usage_grants TO authenticated;
GRANT ALL ON public.usage_grants TO service_role;
ALTER TABLE public.usage_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creators read own grants" ON public.usage_grants FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- 5. Listing purchases
CREATE TABLE public.listing_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  participant_id text NOT NULL,
  buyer_user_id uuid,
  mode text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'paid',
  provider_ref text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.listing_purchases
  ADD CONSTRAINT listing_purchases_mode_check CHECK (mode IN ('take','results')),
  ADD CONSTRAINT listing_purchases_status_check CHECK (status IN ('paid','refunded'));
CREATE UNIQUE INDEX listing_purchases_provider_ref_key ON public.listing_purchases(provider_ref);
CREATE INDEX listing_purchases_lookup_idx ON public.listing_purchases(participant_id, test_id, environment);
GRANT SELECT ON public.listing_purchases TO authenticated;
GRANT ALL ON public.listing_purchases TO service_role;
ALTER TABLE public.listing_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creators read own listing purchases" ON public.listing_purchases FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- 6. Creator earnings ledger
CREATE TABLE public.creator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL UNIQUE REFERENCES public.listing_purchases(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  month text NOT NULL,
  gross_cents integer NOT NULL,
  fee_bps integer NOT NULL,
  fee_cents integer NOT NULL,
  net_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'open',
  payout_id uuid,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_earnings
  ADD CONSTRAINT creator_earnings_status_check CHECK (status IN ('open','pending','paid','reversed'));
CREATE INDEX creator_earnings_creator_month_idx ON public.creator_earnings(creator_id, month);
GRANT SELECT ON public.creator_earnings TO authenticated;
GRANT ALL ON public.creator_earnings TO service_role;
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creators read own earnings" ON public.creator_earnings FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- 7. Monthly payouts
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  month text NOT NULL,
  gross_cents integer NOT NULL DEFAULT 0,
  fee_cents integer NOT NULL DEFAULT 0,
  net_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reference text,
  note text,
  environment text NOT NULL DEFAULT 'sandbox',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_status_check CHECK (status IN ('pending','paid')),
  ADD CONSTRAINT payouts_unique_month UNIQUE (creator_id, month, environment);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creators read own payouts" ON public.payouts FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE TRIGGER payouts_touch BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. Payout accounts
CREATE TABLE public.payout_accounts (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'bank',
  details text NOT NULL DEFAULT '',
  holder_name text,
  country text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payout_accounts
  ADD CONSTRAINT payout_accounts_method_check CHECK (method IN ('bank','paypal','wise','other'));
GRANT SELECT, INSERT, UPDATE ON public.payout_accounts TO authenticated;
GRANT ALL ON public.payout_accounts TO service_role;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own payout account" ON public.payout_accounts FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE POLICY "insert own payout account" ON public.payout_accounts FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "update own payout account" ON public.payout_accounts FOR UPDATE TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
CREATE TRIGGER payout_accounts_touch BEFORE UPDATE ON public.payout_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 9. Admin audit log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit log" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));