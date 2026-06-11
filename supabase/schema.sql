-- Create plan check constraint type or inline
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  total_requests BIGINT DEFAULT 0,
  monthly_requests BIGINT DEFAULT 0,
  month_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  razorpay_customer_id TEXT,
  paypal_customer_id TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  label TEXT DEFAULT 'Default',
  is_active BOOLEAN DEFAULT true,
  monthly_requests BIGINT DEFAULT 0,
  total_requests BIGINT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  prompt_preview TEXT, -- first 120 chars
  model_used TEXT,
  provider TEXT,
  cache_hit TEXT CHECK (cache_hit IN ('exact', 'semantic', 'miss')),
  complexity TEXT CHECK (complexity IN ('simple', 'complex')),
  baseline_tokens INTEGER DEFAULT 0,
  actual_tokens INTEGER DEFAULT 0,
  tokens_saved INTEGER DEFAULT 0,
  baseline_cost_usd NUMERIC(10,8) DEFAULT 0,
  actual_cost_usd NUMERIC(10,8) DEFAULT 0,
  cost_saved_usd NUMERIC(10,8) DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  provider TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Policies for API Keys
CREATE POLICY "Users can manage own api keys" ON public.api_keys
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all api keys" ON public.api_keys
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Policies for Usage Logs
CREATE POLICY "Users can read own usage logs" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all usage logs" ON public.usage_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Policies for Processed Webhooks (Admin or System only)
CREATE POLICY "Admins can read processed webhooks" ON public.processed_webhooks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Global Stats View
CREATE OR REPLACE VIEW public.global_stats AS
SELECT
  COALESCE(COUNT(*), 0) AS total_requests,
  COALESCE(SUM(tokens_saved), 0) AS total_tokens_saved,
  COALESCE(SUM(cost_saved_usd), 0) AS total_usd_saved,
  ROUND(COALESCE(AVG(CASE WHEN cache_hit != 'miss' THEN 100 ELSE 0 END), 0), 2) AS cache_hit_rate_pct
FROM public.usage_logs;

-- Trigger Function: Auto-insert profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, plan, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    'free',
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger setup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC Function: Increment request counts atomically
CREATE OR REPLACE FUNCTION public.increment_request_count(p_user_id UUID, p_api_key_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET 
    total_requests = total_requests + 1,
    monthly_requests = monthly_requests + 1,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF p_api_key_id IS NOT NULL THEN
    UPDATE public.api_keys
    SET
      total_requests = total_requests + 1,
      monthly_requests = monthly_requests + 1,
      last_used_at = NOW()
    WHERE id = p_api_key_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC Function: Get daily stats for past 30 days
CREATE OR REPLACE FUNCTION public.get_daily_stats(p_user_id UUID)
RETURNS TABLE (
  day DATE,
  requests BIGINT,
  usd_saved NUMERIC,
  tokens_saved BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    created_at::DATE AS day,
    COUNT(*)::BIGINT AS requests,
    COALESCE(SUM(cost_saved_usd), 0)::NUMERIC AS usd_saved,
    COALESCE(SUM(usage_logs.tokens_saved), 0)::BIGINT AS tokens_saved
  FROM public.usage_logs
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY created_at::DATE
  ORDER BY created_at::DATE ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
