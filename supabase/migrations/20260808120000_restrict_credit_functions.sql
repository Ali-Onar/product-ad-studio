-- ============================================================================
-- Restrict credit functions to the service role
-- ============================================================================
-- add_credits() and check_and_deduct_credits() are SECURITY DEFINER, and
-- Postgres grants EXECUTE to PUBLIC by default. Combined with PostgREST's
-- /rpc/ endpoints that meant any signed-in user could call them straight from
-- the browser:
--
--   supabase.rpc('add_credits', { p_user_id: <self>, p_amount: 1000000 })
--     -> free credits
--   supabase.rpc('check_and_deduct_credits', { p_user_id: <someone else> })
--     -> drain another user's balance
--
-- Both take the user id as a parameter rather than reading auth.uid(), so
-- there is nothing stopping a caller from naming any account. Credits are
-- money, so execution is revoked from every client-facing role; the server
-- calls these with the service role after verifying the session itself.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION add_credits(UUID, INTEGER, credit_transaction_type, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION check_and_deduct_credits(UUID, INTEGER, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION add_credits(UUID, INTEGER, credit_transaction_type, UUID, TEXT)
  TO service_role;

GRANT EXECUTE ON FUNCTION check_and_deduct_credits(UUID, INTEGER, UUID, TEXT)
  TO service_role;

-- Trigger functions are never called directly by clients either.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_updated_at() FROM PUBLIC, anon, authenticated;
