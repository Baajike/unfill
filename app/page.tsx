import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { pillLinkClass } from "@/components/Button";
import { CategoryPicker } from "@/components/CategoryPicker";
import { Logo } from "@/components/Logo";
import { StreakBadge } from "@/components/StreakBadge";
import { WordsToTry } from "@/components/WordsToTry";
import { levelMinutes, targetSecondsForLevel } from "@/lib/levels";
import { DEFAULT_TIMEZONE, computeStreak, isValidTimeZone } from "@/lib/streak";
import { getUser } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/topics";
import { WORDS_TO_TRY } from "@/lib/word-bank";

// Bounded so the query stays small; at 15 sessions/day this still covers 200+ days.
const STREAK_LOOKBACK_ROWS = 3000;

/** "Good morning/afternoon/evening" for the current hour in the user's saved timezone. */
function greeting(timezone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

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
    <div className="flex flex-1 flex-col gap-6 animate-rise">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="text-lg font-extrabold tracking-tight">Unfill</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/words" className={pillLinkClass}>
            Words
          </Link>
          <Link href="/history" className={pillLinkClass}>
            History
          </Link>
        </nav>
      </header>

      <section>
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{greeting(timezone)}</h1>
        <p className="mt-1 text-muted">Ready for today&apos;s session?</p>
      </section>

      <section>
        <StreakBadge days={streak} minutes={minutes} level={level} capped={capped} total={total} />
        <p className="mt-3 text-sm text-muted">
          {streak === 0 ? "Finish a session today to start one." : "Keep it going today."}
        </p>
      </section>

      <WordsToTry words={wordsToTry} />

      <CategoryPicker categories={CATEGORIES} minutes={minutes} />

      <form action={signOut} className="mt-auto flex justify-center pt-2">
        <button type="submit" className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted hover:text-ink">
          Sign out
        </button>
      </form>
    </div>
  );
}
