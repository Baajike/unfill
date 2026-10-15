import { TINT, type Tint } from "./categoryTint";

type Better = "lower" | "higher" | "neutral";

function Comparison({
  label,
  current,
  other,
  better,
  decimals,
  goodClass,
}: {
  label: string;
  current: number;
  other: number | null;
  better: Better;
  decimals: number;
  goodClass: string;
}) {
  if (other === null) return <span className="text-muted">{label} —</span>;

  const diff = current - other;
  const threshold = 0.5 * 10 ** -decimals;
  if (Math.abs(diff) < threshold) return <span className="text-muted">{label} same</span>;

  const up = diff > 0;
  const improved = better === "neutral" ? null : (better === "higher") === up;
  const tone = improved ? `font-bold ${goodClass}` : "text-muted";
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
  tint = "mint",
}: {
  label: string;
  value: number | null;
  unit?: string;
  previous?: number | null;
  average?: number | null;
  better?: Better;
  decimals?: number;
  tint?: Tint;
}) {
  const t = TINT[tint];
  return (
    <div className={`flex h-40 flex-col justify-between rounded-card p-4 ${t.gradient} ${t.shadow}`}>
      <p className={`text-[0.6875rem] font-extrabold tracking-[0.9px] uppercase ${t.text}`}>{label}</p>
      <p className="text-[2rem] leading-none font-extrabold tracking-tight tabular-nums">
        {value === null ? "—" : value.toFixed(decimals)}
        {unit && value !== null ? <span className={`ml-1 text-base font-bold ${t.text}`}>{unit}</span> : null}
      </p>
      {value !== null && (previous !== undefined || average !== undefined) ? (
        <p className="flex flex-col gap-0.5 text-xs font-semibold tabular-nums">
          <Comparison
            label="vs last"
            current={value}
            other={previous ?? null}
            better={better}
            decimals={decimals}
            goodClass={t.text}
          />
          <Comparison
            label="vs 7-day"
            current={value}
            other={average ?? null}
            better={better}
            decimals={decimals}
            goodClass={t.text}
          />
        </p>
      ) : (
        <span aria-hidden />
      )}
    </div>
  );
}
