type Better = "lower" | "higher" | "neutral";

function Comparison({
  label,
  current,
  other,
  better,
  decimals,
}: {
  label: string;
  current: number;
  other: number | null;
  better: Better;
  decimals: number;
}) {
  if (other === null) return <span className="text-faint">{label} —</span>;

  const diff = current - other;
  const threshold = 0.5 * 10 ** -decimals;
  if (Math.abs(diff) < threshold) return <span className="text-muted">{label} same</span>;

  const up = diff > 0;
  const improved = better === "neutral" ? null : (better === "higher") === up;
  const tone = improved === null ? "text-muted" : improved ? "text-accent-strong" : "text-muted";
  return (
    <span className={tone}>
      {label} <span aria-hidden>{up ? "↑" : "↓"}</span>
      <span className="sr-only">{up ? "up" : "down"}</span> {Math.abs(diff).toFixed(decimals)}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  previous,
  average,
  better = "neutral",
  decimals = 1,
}: {
  label: string;
  value: number | null;
  unit?: string;
  previous?: number | null;
  average?: number | null;
  better?: Better;
  decimals?: number;
}) {
  return (
    <div className="rounded-card bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
        {value === null ? "—" : value.toFixed(decimals)}
        {unit && value !== null ? <span className="ml-1 text-base font-normal text-muted">{unit}</span> : null}
      </p>
      {value !== null && (previous !== undefined || average !== undefined) ? (
        <p className="mt-2 flex flex-col gap-0.5 text-sm tabular-nums">
          <Comparison label="vs last" current={value} other={previous ?? null} better={better} decimals={decimals} />
          <Comparison label="vs 7-day" current={value} other={average ?? null} better={better} decimals={decimals} />
        </p>
      ) : null}
    </div>
  );
}
