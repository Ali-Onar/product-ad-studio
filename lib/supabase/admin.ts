import "server-only";

import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";

/**
 * Service-role client. Bypasses RLS entirely — never import this from a client
 * component, and never pass it a user-supplied id without checking the session
 * first.
 *
 * Used for operations users must not be able to invoke directly: crediting and
 * debiting balances, and (later) webhook / Wiro callback writes.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, { auth: { persistSession: false, autoRefreshToken: false }, });
}
