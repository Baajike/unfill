import Link from "next/link";
import { redirect } from "next/navigation";
import { pillLinkClass } from "@/components/Button";
import { TINT, categoryTint } from "@/components/categoryTint";
import { formatClock } from "@/components/Timer";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/streak";
import { getUser } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/topics";
import { metricsSchema } from "@/lib/validation";

const HISTORY_LIMIT = 200;

export default async function HistoryPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const [profileRes, sessionsRes] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
    supabase
      .from("sessions")
      .select("id, topic, topic_category, duration_seconds, metrics, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const tz = profileRes.data?.timezone;
  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const sessions = sessionsRes.data ?? [];

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <header className="flex items-center justify-between">
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">History</h1>
        <Link href="/" className={pillLinkClass}>
          Home
        </Link>
      </header>

      {sessions.length === 0 ? (
        <p className="rounded-card border border-border bg-white p-5 text-muted shadow-card">
          No sessions yet. Your first one will show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => {
            const m = metricsSchema.safeParse(s.metrics).data;
            const category = categoryLabel(s.topic_category);
            const tint = TINT[categoryTint(s.topic_category)];
            return (
              <li key={s.id}>
                <Link
                  href={`/results/${s.id}`}
                  className="block rounded-card border border-border bg-white p-4 shadow-card transition duration-150 hover:bg-field active:translate-y-px"
                >
                  <div className="flex items-center justify-between gap-3">
                    {category ? (
                      <span
                        className={`inline-flex h-7 min-w-0 items-center truncate rounded-full px-3 text-xs font-bold ${tint.bg} ${tint.text}`}
                      >
                        {category}
                      </span>
                    ) : (
                      <span />
                    )}
                    <p className="shrink-0 text-sm font-semibold text-muted">
                      {dateFormat.format(new Date(s.created_at))}
                    </p>
                  </div>
                  <p className="mt-2.5 truncate font-bold">{s.topic}</p>
                  <p className="mt-1 text-sm text-muted tabular-nums">
                    {formatClock(s.duration_seconds)}
                    {m ? ` · ${m.fillers_per_minute.toFixed(1)} fillers/min · ${Math.round(m.words_per_minute)} wpm` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
