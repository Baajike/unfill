import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { CategoryPicker } from "@/components/CategoryPicker";
import { StreakBadge } from "@/components/StreakBadge";
import { WordsToTry } from "@/components/WordsToTry";
import { levelMinutes, targetSecondsForLevel } from "@/lib/levels";
import { DEFAULT_TIMEZONE, computeStreak } from "@/lib/streak";
import { getUser } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/topics";
import { WORDS_TO_TRY } from "@/lib/word-bank";

// Bounded so the query stays small; at 15 sessions/day this still covers 200+ days.
const STREAK_LOOKBACK_ROWS = 3000;

export default async function HomePage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const [profileRes, completedRes, totalRes, wordsRes] = await Promise.all([
    supabase.from("profiles").select("current_level, timezone").eq("id", user.id).single(),
    supabase
      .from("sessions")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("completed", true)
      .order("created_at", { ascending: false })
      .limit(STREAK_LOOKBACK_ROWS),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("word_bank")
      .select("phrase")
      .eq("user_id", user.id)
      .eq("status", "new")
      .order("created_at", { ascending: true })
      .limit(WORDS_TO_TRY),
  ]);

  const level = profileRes.data?.current_level ?? 1;
  const timezone = profileRes.data?.timezone ?? DEFAULT_TIMEZONE;
  const streak = computeStreak(
    (completedRes.data ?? []).map((s) => s.created_at),
    new Date(),
    timezone,
  );
  const total = totalRes.count ?? 0;
  const wordsToTry = (wordsRes.data ?? []).map((w) => w.phrase);
  const minutes = targetSecondsForLevel(level) / 60;
  const capped = levelMinutes(level) > minutes;

  return (
    <div className="flex flex-1 flex-col animate-rise">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">Unfill</span>
        <nav className="-mr-3 flex items-center">
          <Link href="/history" className="min-h-11 px-3 leading-[2.75rem] text-muted hover:text-ink">
            History
          </Link>
          <Link href="/words" className="min-h-11 px-3 leading-[2.75rem] text-muted hover:text-ink">
            Words
          </Link>
          <form action={signOut}>
            <button type="submit" className="min-h-11 px-3 text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <section className="mt-14">
        <StreakBadge days={streak} />
        <p className="mt-2 text-muted">
          {streak === 0 ? "Finish a session today to start one." : "Keep it going today."}
        </p>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3">
        <div className="rounded-card bg-surface p-4">
          <p className="text-sm text-muted">Today&apos;s session</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {minutes} <span className="text-base font-normal text-muted">{minutes === 1 ? "min" : "mins"}</span>
          </p>
          <p className="mt-1 text-sm text-faint">Level {level}{capped ? " (max for now)" : ""}</p>
        </div>
        <div className="rounded-card bg-surface p-4">
          <p className="text-sm text-muted">Sessions</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
          <p className="mt-1 text-sm text-faint">in total</p>
        </div>
      </section>

      <WordsToTry words={wordsToTry} className="mt-3" />

      <CategoryPicker categories={CATEGORIES} className="mt-auto pt-12" />
    </div>
  );
}
