import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { FeedbackCard } from "@/components/FeedbackCard";
import { MetricCard } from "@/components/MetricCard";
import { formatClock } from "@/components/Timer";
import { TranscriptView } from "@/components/TranscriptView";
import { getUser } from "@/lib/supabase/server";
import type { Metrics } from "@/lib/types";
import { metricsSchema, storedFeedbackSchema, uuidSchema } from "@/lib/validation";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseMetrics(value: unknown): Metrics | null {
  return metricsSchema.safeParse(value).data ?? null;
}

function average(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export default async function ResultsPage({ params }: PageProps<"/results/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, topic, target_seconds, duration_seconds, completed, transcript, metrics, feedback, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) notFound();

  const metrics = parseMetrics(session.metrics);
  const feedback = storedFeedbackSchema.safeParse(session.feedback).data ?? null;
  const weekStart = new Date(new Date(session.created_at).getTime() - WEEK_MS).toISOString();

  const [prevRes, weekRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("metrics")
      .eq("user_id", user.id)
      .lt("created_at", session.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("metrics")
      .eq("user_id", user.id)
      .lt("created_at", session.created_at)
      .gte("created_at", weekStart),
  ]);

  const previous = parseMetrics(prevRes.data?.metrics);
  const week = (weekRes.data ?? []).map((s) => parseMetrics(s.metrics)).filter((m) => m !== null);
  const avg = (pick: (m: Metrics) => number | null) => (week.length > 0 ? average(week.map(pick)) : null);
  const prev = (pick: (m: Metrics) => number | null) => (previous ? pick(previous) : null);

  const uniquePct = (m: Metrics) => m.unique_word_ratio * 100;
  const breakdown = Object.entries(metrics?.filler_breakdown ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-10 animate-rise">
      <header>
        <p className="text-sm text-muted">
          {formatClock(session.duration_seconds)} of {formatClock(session.target_seconds)}
          {session.completed ? " · Completed" : " · Shorter than your target"}
        </p>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight">{session.topic}</h1>
      </header>

      {metrics ? (
        <section aria-label="Your numbers" className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Fillers / min"
            value={metrics.fillers_per_minute}
            previous={prev((m) => m.fillers_per_minute)}
            average={avg((m) => m.fillers_per_minute)}
            better="lower"
          />
          <MetricCard
            label="Words / min"
            value={metrics.words_per_minute}
            previous={prev((m) => m.words_per_minute)}
            average={avg((m) => m.words_per_minute)}
            decimals={0}
          />
          <MetricCard
            label="Unique words"
            value={uniquePct(metrics)}
            unit="%"
            previous={prev(uniquePct)}
            average={avg(uniquePct)}
            better="higher"
            decimals={0}
          />
          <MetricCard
            label="Long pauses"
            value={metrics.long_pauses}
            previous={prev((m) => m.long_pauses)}
            average={avg((m) => m.long_pauses)}
            better="lower"
            decimals={0}
          />
        </section>
      ) : null}

      {metrics && (breakdown.length > 0 || metrics.top_repeated.length > 0) ? (
        <section className="flex flex-col gap-5">
          {breakdown.length > 0 ? (
            <div>
              <h2 className="text-sm font-medium text-muted">Fillers ({metrics.filler_count})</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {breakdown.map(([word, count]) => (
                  <li key={word} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-strong">
                    {word} <span className="tabular-nums opacity-70">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {metrics.top_repeated.length > 0 ? (
            <div>
              <h2 className="text-sm font-medium text-muted">Most repeated words</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {metrics.top_repeated.map(({ word, count }) => (
                  <li key={word} className="rounded-full bg-surface px-3 py-1 text-sm">
                    {word} <span className="tabular-nums text-muted">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Feedback</h2>
        <FeedbackCard feedback={feedback} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">What you said</h2>
        <TranscriptView text={session.transcript} />
      </section>

      <div className="flex flex-col gap-3 pt-2">
        <ButtonLink href="/session" size="lg">
          Try again
        </ButtonLink>
        <ButtonLink href="/" size="lg" variant="secondary">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
