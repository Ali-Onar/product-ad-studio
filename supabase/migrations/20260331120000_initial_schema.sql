-- ============================================================================
-- Product Ad Studio — Initial Database Schema
-- ============================================================================
-- This migration creates all tables, functions, triggers, and RLS policies
-- for the MVP: user profiles, Lemon Squeezy subscriptions, credit system,
-- and Wiro AI generation tracking.
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENUM TYPES
-- ============================================================================

CREATE TYPE subscription_status AS ENUM (
  'active',
  'cancelled',
  'past_due',
  'paused',
  'expired',
  'on_trial',
  'unpaid'
);

CREATE TYPE generation_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE generation_model AS ENUM (
  'product-photoshoot',
  'product-ads'
);

CREATE TYPE credit_transaction_type AS ENUM (
  'subscription_renewal',
  'generation',
  'admin_adjustment',
  'refund'
);

-- ============================================================================
-- SECTION 2: UTILITY FUNCTIONS
-- ============================================================================

-- Reusable trigger function to auto-update the updated_at column
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 3: TABLES
-- ============================================================================

-- 3a: user_profiles
-- Linked to auth.users — one row per user, created automatically via trigger
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_profiles IS 'Public profile data for each user, auto-created on signup';

-- 3b: subscriptions
-- Tracks Lemon Squeezy subscription state via webhooks
CREATE TABLE subscriptions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  lemon_squeezy_subscription_id TEXT NOT NULL UNIQUE,
  lemon_squeezy_customer_id     TEXT,
  lemon_squeezy_order_id        TEXT,
  variant_id                    TEXT,
  product_id                    TEXT,
  plan_name                     TEXT NOT NULL,
  status                        subscription_status NOT NULL DEFAULT 'active',
  current_period_start          TIMESTAMPTZ,
  current_period_end            TIMESTAMPTZ,
  trial_ends_at                 TIMESTAMPTZ,
  renews_at                     TIMESTAMPTZ,
  ends_at                       TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE subscriptions IS 'Lemon Squeezy subscription records, managed via webhooks';

-- 3c: credit_balances
-- Separate from user_profiles so FOR UPDATE locks don't block profile reads
CREATE TABLE credit_balances (
  user_id    UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE credit_balances IS 'Current credit balance per user. CHECK constraint prevents negative balances.';

-- 3d: credit_transactions
-- Immutable audit log — no updated_at, append-only
CREATE TABLE credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type          credit_transaction_type NOT NULL,
  reference_id  UUID,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE credit_transactions IS 'Immutable audit trail of all credit changes (additions and deductions)';
COMMENT ON COLUMN credit_transactions.amount IS 'Positive for additions, negative for deductions';
COMMENT ON COLUMN credit_transactions.reference_id IS 'Points to generations.id or subscriptions.id depending on type';

-- 3e: generations
-- Tracks AI generation jobs (Wiro API)
CREATE TABLE generations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type                     TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  model                    generation_model NOT NULL,
  status                   generation_status NOT NULL DEFAULT 'pending',
  wiro_task_id             TEXT,
  input_storage_path       TEXT,
  output_storage_paths     TEXT[] NOT NULL DEFAULT '{}',
  parameters               JSONB NOT NULL DEFAULT '{}'::jsonb,
  credits_used             INTEGER NOT NULL DEFAULT 0,
  error_message            TEXT,
  started_at               TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE generations IS 'AI generation jobs via Wiro API (product photos and video ads)';
COMMENT ON COLUMN generations.input_storage_path IS 'Path in generations bucket: {user_id}/{generation_id}/input.png';
COMMENT ON COLUMN generations.output_storage_paths IS 'Paths in generations bucket: {user_id}/{generation_id}/output-1.mp4, etc.';
COMMENT ON COLUMN generations.parameters IS 'Model-specific params. Photoshoot: {style, plan, ratio, outputType}. Ads: {videoMode, ratio, effectType}';

-- ============================================================================
-- SECTION 4: INDEXES
-- ============================================================================

CREATE INDEX idx_subscriptions_user_id
  ON subscriptions(user_id);

CREATE INDEX idx_credit_transactions_user_created
  ON credit_transactions(user_id, created_at DESC);

CREATE INDEX idx_generations_user_created
  ON generations(user_id, created_at DESC);

-- Partial index: only pending/processing rows for active job lookups
CREATE INDEX idx_generations_active_status
  ON generations(status)
  WHERE status IN ('pending', 'processing');

-- Partial index: lookup by Wiro task ID for callback handling
CREATE INDEX idx_generations_wiro_task_id
  ON generations(wiro_task_id)
  WHERE wiro_task_id IS NOT NULL;

-- ============================================================================
-- SECTION 5: FUNCTIONS & TRIGGERS
-- ============================================================================

-- 5a: Auto-create user_profiles + credit_balances on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  INSERT INTO credit_balances (user_id, balance)
  VALUES (NEW.id, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 5b: Check balance and deduct credits atomically
-- Returns TRUE if deduction succeeded, FALSE if insufficient balance
CREATE OR REPLACE FUNCTION check_and_deduct_credits(
  p_user_id      UUID,
  p_amount        INTEGER,
  p_generation_id UUID DEFAULT NULL,
  p_description   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
BEGIN
  -- Lock the row to prevent concurrent deductions
  SELECT balance INTO v_current_balance
  FROM credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit balance not found for user %', p_user_id;
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Deduct credits
  UPDATE credit_balances
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- Record the transaction
  INSERT INTO credit_transactions (user_id, amount, balance_after, type, reference_id, description)
  VALUES (p_user_id, -p_amount, v_new_balance, 'generation', p_generation_id, p_description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5c: Add credits (for subscription renewals, refunds, admin adjustments)
-- Returns the new balance
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id      UUID,
  p_amount        INTEGER,
  p_type          credit_transaction_type DEFAULT 'subscription_renewal',
  p_reference_id  UUID DEFAULT NULL,
  p_description   TEXT DEFAULT NULL
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE credit_balances
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit balance not found for user %', p_user_id;
  END IF;

  INSERT INTO credit_transactions (user_id, amount, balance_after, type, reference_id, description)
  VALUES (p_user_id, p_amount, v_new_balance, p_type, p_reference_id, p_description);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 6: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- user_profiles: users can read and update their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- subscriptions: users can only read their own subscriptions
-- Insert/update handled by service_role (webhook handler bypasses RLS)
CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- credit_balances: users can only read their own balance
-- Mutations handled by SECURITY DEFINER functions
CREATE POLICY "Users can read own credit balance"
  ON credit_balances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- credit_transactions: users can only read their own transactions
-- Inserts handled by SECURITY DEFINER functions
CREATE POLICY "Users can read own credit transactions"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- generations: users can read and create their own generations
-- Status updates handled by service_role (Wiro callback bypasses RLS)
CREATE POLICY "Users can read own generations"
  ON generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own generations"
  ON generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SECTION 7: STORAGE BUCKET
-- ============================================================================

-- Private bucket for generation input/output files
-- Structure: {user_id}/{generation_id}/input.png
--            {user_id}/{generation_id}/output-1.mp4
INSERT INTO storage.buckets (id, name, public)
VALUES ('generations', 'generations', false);

-- Users can upload input images to their own folder
CREATE POLICY "Users can upload own generation files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own generation files (for signed URL creation)
CREATE POLICY "Users can read own generation files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own generation files
CREATE POLICY "Users can delete own generation files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'generations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can manage all files (for Wiro API callback to upload outputs)
-- Note: service_role bypasses RLS by default, no explicit policy needed

-- ============================================================================
-- SECTION 8: UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at_generations
  BEFORE UPDATE ON generations
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
