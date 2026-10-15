/** Live microphone level. `level` is 0–1, or null when the meter can't run. */
export function LevelMeter({ level }: { level: number | null }) {
  if (level === null) {
    return <p className="text-center text-sm text-muted">Mic level unavailable</p>;
  }
  const clamped = Math.min(1, Math.max(0, level));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-mint"
      role="meter"
      aria-label="Microphone level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className="h-full origin-left rounded-full bg-primary transition-transform duration-100 ease-out"
        style={{ transform: `scaleX(${clamped})` }}
      />
    </div>
  );
}
