// Keep in sync with public.apply_level_up() in supabase/migrations/0001_init.sql.

export const LEVEL_MINUTES = [1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60] as const;

/**
 * Uploads go through a Vercel function, which caps request bodies at 4.5 MB,
 * so sessions are clamped to 5 minutes until chunked upload exists (see README).
 */
export const MAX_EFFECTIVE_MINUTES = 5;

export const LEVEL_UP_STREAK = 3;
export const LEVEL_UP_MAX_FILLERS_PER_MINUTE = 4;
export const COMPLETION_RATIO = 0.8;
export const MIN_RECORDING_SECONDS = 30;

export const MAX_LEVEL = LEVEL_MINUTES.length;

/** Highest level whose length fits within the effective cap. */
export const MAX_REACHABLE_LEVEL = LEVEL_MINUTES.filter((m) => m <= MAX_EFFECTIVE_MINUTES).length;

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(MAX_LEVEL, Math.max(1, Math.trunc(level)));
}

export function levelMinutes(level: number): number {
  return LEVEL_MINUTES[clampLevel(level) - 1];
}

export function targetSecondsForLevel(level: number): number {
  return Math.min(levelMinutes(level), MAX_EFFECTIVE_MINUTES) * 60;
}

export function isCompleted(durationSeconds: number, targetSeconds: number): boolean {
  return targetSeconds > 0 && durationSeconds >= targetSeconds * COMPLETION_RATIO;
}

export type LevelSession = {
  target_seconds: number;
  completed: boolean;
  fillers_per_minute: number;
};

/**
 * @param recentSessions the user's most recent sessions, newest first.
 * Returns the level the user should be at now. Never lowers the level.
 */
export function nextLevel(currentLevel: number, recentSessions: LevelSession[]): number {
  const level = clampLevel(currentLevel);
  if (level >= MAX_REACHABLE_LEVEL) return level;

  const target = targetSecondsForLevel(level);
  const lastFew = recentSessions.slice(0, LEVEL_UP_STREAK);
  const qualifies =
    lastFew.length === LEVEL_UP_STREAK &&
    lastFew.every(
      (s) =>
        s.target_seconds === target &&
        s.completed &&
        s.fillers_per_minute <= LEVEL_UP_MAX_FILLERS_PER_MINUTE,
    );

  return qualifies ? level + 1 : level;
}
