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

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfacing this early makes a misconfigured deploy obvious instead of
  // failing later with an opaque "fetch failed" on the first auth call.
  console.error(
    "Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env"
  );
}

export const supabase = createClient(url || "", anonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
