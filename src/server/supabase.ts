import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../types/database";
import { Request } from "express";

const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY || "";

/**
 * Gets a Supabase client that uses the service role key.
 * This client BYPASSES Row Level Security (RLS).
 * Only use this for internal backend tasks (e.g. background jobs) where admin privileges are required.
 */
export function getServiceRoleClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.");
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Gets a request-scoped Supabase client that acts on behalf of the authenticated user.
 * This client ENFORCES Row Level Security (RLS) based on the provided JWT.
 */
export function getAuthClient(req: Request): SupabaseClient<Database> {
  if (!supabaseUrl || !publishableKey) {
    console.warn("WARNING: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY missing.");
  }
  
  // Create a client with the anon key
  const client = createClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Extract token from request headers
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // Attach the user's JWT to this client instance for RLS
    // In @supabase/supabase-js v2, we set the auth header directly on the global headers of this client instance
    client.realtime.setAuth(token); // for realtime channels if needed
    (client as any).rest.headers['Authorization'] = `Bearer ${token}`; // Internal workaround for supabase-js scoping
    
    // The officially supported way in SSR is to pass global headers
    return createClient<Database>(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return client;
}
