export function StreakBadge({ days }: { days: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-6xl font-semibold tracking-tight tabular-nums">{days}</span>
      <span className="text-lg text-muted">day streak</span>
    </div>
  );
}
