export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Timer({ remaining, total }: { remaining: number; total: number }) {
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
  return (
    <div className="w-full" role="timer" aria-live="off" aria-label={`${formatClock(remaining)} remaining`}>
      <p className="text-center text-7xl font-extrabold tracking-tight tabular-nums">{formatClock(remaining)}</p>
      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-mint">
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-linear"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}
