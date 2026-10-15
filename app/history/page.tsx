import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
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
    <div className="flex flex-col animate-rise">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <ButtonLink href="/" variant="ghost" size="md" className="-mr-5">
          Home
        </ButtonLink>
      </header>

      {sessions.length === 0 ? (
        <p className="mt-10 text-muted">No sessions yet. Your first one will show up here.</p>
      ) : (
        <ul className="mt-6 flex flex-col divide-y divide-line">
          {sessions.map((s) => {
            const m = metricsSchema.safeParse(s.metrics).data;
            const category = categoryLabel(s.topic_category);
            return (
              <li key={s.id}>
                <Link
                  href={`/results/${s.id}`}
                  className="-mx-3 block rounded-2xl px-3 py-4 transition-colors hover:bg-surface"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="truncate font-medium">{s.topic}</p>
                    <p className="shrink-0 text-sm text-muted">{dateFormat.format(new Date(s.created_at))}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted tabular-nums">
                    {category ? `${category} · ` : ""}
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
