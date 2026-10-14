export const DEFAULT_TIMEZONE = "UTC";

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar day ("YYYY-MM-DD") of an instant in the given IANA timezone. */
export function dayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Steps a "YYYY-MM-DD" key back one calendar day. UTC arithmetic avoids DST. */
function previousDay(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive days, ending today or yesterday, with at least one completed
 * session. A day that has not finished yet never breaks the streak.
 */
export function computeStreak(
  completedAt: Array<Date | string>,
  now: Date,
  timeZone: string,
): number {
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const days = new Set(completedAt.map((d) => dayKey(new Date(d), tz)));

  let cursor = dayKey(now, tz);
  if (!days.has(cursor)) cursor = previousDay(cursor);

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}
