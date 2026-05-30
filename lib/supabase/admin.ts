import { createClient } from "@supabase/supabase-js";

// Always hit the database fresh — Next.js patches global fetch with a data cache
// that would otherwise serve stale rows to the cron/scoring routes.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

// Service-role client. Bypasses RLS — use ONLY in trusted server code (cron, scoring).
// Never import this into a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    }
  );
}
