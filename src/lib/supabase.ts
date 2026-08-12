import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/database";

// Vite exposes env variables prefixed with VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL_FALLBACK || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY_FALLBACK || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not found in environment. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env");
}

// Global browser client (singleton)
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
