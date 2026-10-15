import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { TINT, categoryTint } from "@/components/categoryTint";
import { FeedbackCard } from "@/components/FeedbackCard";
import { MetricCard } from "@/components/MetricCard";
import { formatClock } from "@/components/Timer";
import { TranscriptView } from "@/components/TranscriptView";
import { MIN_SCORABLE_WPM, isTooShortToScore } from "@/lib/metrics";
import { getUser } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/topics";
import type { Metrics } from "@/lib/types";
import { metricsSchema, storedFeedbackSchema, uuidSchema } from "@/lib/validation";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// How far back to look for the most recent scorable session to compare against.
const PREVIOUS_LOOKBACK = 20;

function parseMetrics(value: unknown): Metrics | null {
  return metricsSchema.safeParse(value).data ?? null;
}

/** Metrics worth comparing against: readable and not "too short to score". */
function scorable(value: unknown): Metrics | null {
  const m = parseMetrics(value);
  return m && !isTooShortToScore(m) ? m : null;
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
    .select(
      "id, topic, topic_category, target_seconds, duration_seconds, completed, transcript, metrics, feedback, created_at",
    )
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
      .limit(PREVIOUS_LOOKBACK),
    supabase
      .from("sessions")
      .select("metrics")
      .eq("user_id", user.id)
      .lt("created_at", session.created_at)
      .gte("created_at", weekStart),
  ]);

  const tooShort = metrics !== null && isTooShortToScore(metrics);
  // "Too short to score" sessions are left out of both comparisons.
  const previous = (prevRes.data ?? []).map((s) => scorable(s.metrics)).find((m) => m !== null) ?? null;
  const week = (weekRes.data ?? []).map((s) => scorable(s.metrics)).filter((m) => m !== null);
  // undefined hides the comparison rows entirely (used when this session is too short).
  const avg = (pick: (m: Metrics) => number | null) =>
    tooShort ? undefined : week.length > 0 ? average(week.map(pick)) : null;
  const prev = (pick: (m: Metrics) => number | null) =>
    tooShort ? undefined : previous ? pick(previous) : null;

  const uniquePct = (m: Metrics) => m.unique_word_ratio * 100;
  const bankWordsUsed = metrics?.bank_words_used ?? [];
  const breakdown = Object.entries(metrics?.filler_breakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const category = categoryLabel(session.topic_category);
  const tint = TINT[categoryTint(session.topic_category)];

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {category ? (
            <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-bold ${tint.bg} ${tint.text}`}>
              {category}
            </span>
          ) : null}
          <p className="text-sm font-semibold text-muted tabular-nums">
            {formatClock(session.duration_seconds)} of {formatClock(session.target_seconds)}
            {tooShort ? " · Too short to score" : session.completed ? " · Completed" : " · Shorter than your target"}
          </p>
        </div>
        <h1 className="mt-3 text-[1.75rem] leading-tight font-extrabold tracking-tight">{session.topic}</h1>
      </header>

      {bankWordsUsed.length > 0 ? (
        <section
          className="flex items-start gap-4 rounded-card bg-gradient-to-br from-sky to-lavender p-5 shadow-sky"
          role="status"
        >
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-soft"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 10.5l3.2 3.2L15 7"
                stroke="#255E86"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="leading-relaxed text-sky-ink">
            You used {bankWordsUsed.length} {bankWordsUsed.length === 1 ? "word" : "words"} from your bank:{" "}
            <span className="font-extrabold">{bankWordsUsed.join(", ")}</span>
          </p>
        </section>
      ) : null}

      {metrics && tooShort ? (
        <section className="rounded-card bg-butter p-5 shadow-butter" role="status">
          <h2 className="text-lg font-extrabold text-butter-ink">Too short to score</h2>
          <p className="mt-2 leading-relaxed">
            We only caught {metrics.word_count} {metrics.word_count === 1 ? "word" : "words"} (
            {Math.round(metrics.words_per_minute)} per minute; scoring starts at {MIN_SCORABLE_WPM}). If
            you spoke the whole time, the recording probably didn&apos;t capture everything. This session
            isn&apos;t compared or counted toward your level.
          </p>
        </section>
      ) : null}

      {metrics ? (
        <section aria-label="Your numbers" className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Fillers / min"
            value={metrics.fillers_per_minute}
            previous={prev((m) => m.fillers_per_minute)}
            average={avg((m) => m.fillers_per_minute)}
            better="lower"
            tint="mint"
          />
          <MetricCard
            label="Words / min"
            value={metrics.words_per_minute}
            previous={prev((m) => m.words_per_minute)}
            average={avg((m) => m.words_per_minute)}
            decimals={0}
            tint="lavender"
          />
          <MetricCard
            label="Unique words"
            value={uniquePct(metrics)}
            unit="%"
            previous={prev(uniquePct)}
            average={avg(uniquePct)}
            better="higher"
            decimals={0}
            tint="sky"
          />
          <MetricCard
            label="Long pauses"
            value={metrics.long_pauses}
            previous={prev((m) => m.long_pauses)}
            average={avg((m) => m.long_pauses)}
            better="lower"
            decimals={0}
            tint="peach"
          />
        </section>
      ) : null}

      {metrics && (breakdown.length > 0 || metrics.top_repeated.length > 0) ? (
        <section className="flex flex-col gap-6">
          {breakdown.length > 0 ? (
            <div>
              <h2 className="section-label">Fillers ({metrics.filler_count})</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {breakdown.map(([word, count]) => (
                  <li
                    key={word}
                    className="inline-flex h-[38px] items-center gap-1.5 rounded-full bg-peach px-4 text-sm font-bold text-peach-ink"
                  >
                    {word} <span className="tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {metrics.top_repeated.length > 0 ? (
            <div>
              <h2 className="section-label">Most repeated words</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {metrics.top_repeated.map(({ word, count }) => (
                  <li
                    key={word}
                    className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-border bg-white px-4 text-sm font-bold shadow-soft"
                  >
                    {word} <span className="tabular-nums text-muted">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="section-label mb-3">Feedback</h2>
        <FeedbackCard feedback={feedback} />
      </section>

      <section>
        <h2 className="section-label mb-3">What you said</h2>
        <TranscriptView text={session.transcript} bankWords={bankWordsUsed} />
      </section>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <ButtonLink href="/" size="lg" variant="secondary">
          Home
        </ButtonLink>
        <ButtonLink href="/session" size="lg">
          Try again
        </ButtonLink>
      </div>
    </div>
  );
}
