import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export const DAILY_ANALYSIS_LIMIT = 15;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Counts the user's saved sessions in the last 24 hours (rolling window).
 * Uses the user's own RLS-scoped client, so it only ever sees their rows.
 * Works on serverless with no extra service. Two simultaneous requests at
 * the limit could both pass; that is acceptable at this scale.
 */
export async function checkDailyLimit(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error || count === null) {
    // Fail closed: if we can't count, don't spend API quota.
    throw new Error("Rate limit check failed");
  }
  return { allowed: count < DAILY_ANALYSIS_LIMIT, remaining: Math.max(0, DAILY_ANALYSIS_LIMIT - count) };
}
