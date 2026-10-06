import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env");
}

if (!/^https:\/\//i.test(supabaseUrl)) {
  throw new Error("VITE_SUPABASE_URL must start with https://");
}

if (supabaseAnonKey.length < 20) {
  throw new Error("VITE_SUPABASE_ANON_KEY looks invalid — paste the anon/public key from Supabase");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
