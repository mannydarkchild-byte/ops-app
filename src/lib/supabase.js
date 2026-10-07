import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

function resolveConfigError() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set both in the Vercel project for Production and Preview, then redeploy.";
  }
  if (!/^https:\/\//i.test(supabaseUrl)) {
    return "VITE_SUPABASE_URL must start with https://";
  }
  if (supabaseAnonKey.length < 20) {
    return "VITE_SUPABASE_ANON_KEY looks invalid — paste the anon/public key from Supabase (Project Settings → API).";
  }
  return null;
}

/** Human-readable setup error, or null when the client can be created. */
export const supabaseConfigError = resolveConfigError();

/**
 * Supabase browser client, or null when env is missing/invalid.
 * Do not call methods when `supabaseConfigError` is set — App shows a config screen instead.
 */
export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
