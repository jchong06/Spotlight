// ============================================================
//  Spotlight — Supabase browser client
//
//  Uses the project URL + anon (public) key, which are safe to ship to the
//  browser; row-level security on the `profiles`/`favorites` tables is what
//  actually scopes data to the signed-in user. Set these in .env:
//    VITE_SUPABASE_URL=https://<project-ref>.supabase.co
//    VITE_SUPABASE_ANON_KEY=<anon public key>
// ============================================================
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://demo.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "demo-anon-key";
const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!configured) {
  console.warn("Supabase is not configured — continuing in demo mode.");
}

export const supabaseConfigured = configured;
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
