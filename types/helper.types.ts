import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

export type SupabaseDBClient = SupabaseClient<Database>

export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type UserProfileInsert = Database["public"]["Tables"]["user_profiles"]["Insert"];
export type UserProfileUpdate = Database["public"]["Tables"]["user_profiles"]["Update"];