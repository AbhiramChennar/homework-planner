// The one Supabase client the whole app uses, created on first use.
//
// The app has no server (it's a static site), so this browser client is the
// only way it talks to Supabase. It uses the public anon/publishable key; RLS
// policies in the database decide what each signed-in user can read and write.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False when .env.local isn't filled in; the app then only offers the demo. */
export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!url || !key) {
    throw new Error("Supabase isn't configured: fill in .env.local (see .env.local.example).");
  }
  client ??= createClient<Database>(url, key, {
    auth: {
      persistSession: true, // stay signed in across visits (stored in localStorage)
      autoRefreshToken: true,
      // Reads the session from the magic link's URL when the user lands back on the site.
      detectSessionInUrl: true,
      // "implicit" (the default) instead of "pkce": with PKCE the link only works
      // in the same browser that requested it, but students often request on a
      // laptop and open the email on their phone.
      flowType: "implicit",
    },
  });
  return client;
}
