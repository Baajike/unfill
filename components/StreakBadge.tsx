import { TINT, type Tint } from "./categoryTint";

function StatCard({
  tint,
  label,
  value,
  unit,
  note,
}: {
  tint: Tint;
  label: string;
  value: number;
  unit: string;
  note?: string;
}) {
  const t = TINT[tint];
  return (
    <div className={`flex min-w-0 flex-col rounded-card p-3.5 ${t.gradient} ${t.shadow}`}>
      <p className={`text-[0.6875rem] font-extrabold tracking-[0.9px] uppercase ${t.text}`}>{label}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-[1.75rem] leading-none font-extrabold tracking-tight tabular-nums">{value}</span>
        <span className={`truncate text-sm font-bold ${t.text}`}>{unit}</span>
      </p>
      {note ? <p className="mt-1.5 truncate text-xs font-semibold text-muted">{note}</p> : null}
    </div>
  );
}

/** Home stats: streak, today's session length and total sessions. */
export function StreakBadge({
  days,
  minutes,
  level,
  capped,
  total,
}: {
  days: number;
  minutes: number;
  level: number;
  capped: boolean;
  total: number;
}) {
  return (
    <section aria-label="Your progress" className="grid grid-cols-3 gap-3">
      <StatCard tint="peach" label="Streak" value={days} unit={days === 1 ? "day" : "days"} />
      <StatCard
        tint="mint"
        label="Today"
        value={minutes}
        unit={minutes === 1 ? "min" : "mins"}
        note={`Level ${level}${capped ? " (max for now)" : ""}`}
      />
      <StatCard tint="lavender" label="Sessions" value={total} unit="total" />
    </section>
  );
}
