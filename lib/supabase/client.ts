import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

/** Browser client. Only the public URL and anon key are ever exposed here. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
