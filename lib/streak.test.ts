import { describe, expect, it } from "vitest";
import { computeStreak, dayKey, isValidTimeZone } from "./streak";

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects junk", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});

describe("dayKey", () => {
  it("uses the user's timezone, not UTC", () => {
    const instant = new Date("2026-03-10T03:00:00Z");
    expect(dayKey(instant, "UTC")).toBe("2026-03-10");
    expect(dayKey(instant, "America/New_York")).toBe("2026-03-09");
    expect(dayKey(instant, "Asia/Tokyo")).toBe("2026-03-10");
  });
});

describe("computeStreak", () => {
  const tz = "Europe/London";
  const now = new Date("2026-06-15T12:00:00Z");

  it("is zero with no sessions", () => {
    expect(computeStreak([], now, tz)).toBe(0);
  });

  it("counts today and the days before it", () => {
    const sessions = ["2026-06-15T08:00:00Z", "2026-06-14T20:00:00Z", "2026-06-13T07:00:00Z"];
    expect(computeStreak(sessions, now, tz)).toBe(3);
  });

  it("does not break the streak when today is not done yet", () => {
    const sessions = ["2026-06-14T08:00:00Z", "2026-06-13T08:00:00Z"];
    expect(computeStreak(sessions, now, tz)).toBe(2);
  });

  it("breaks when yesterday was missed", () => {
    const sessions = ["2026-06-13T08:00:00Z", "2026-06-12T08:00:00Z"];
    expect(computeStreak(sessions, now, tz)).toBe(0);
  });

  it("counts several sessions on one day once", () => {
    const sessions = ["2026-06-15T08:00:00Z", "2026-06-15T09:00:00Z", "2026-06-15T10:00:00Z"];
    expect(computeStreak(sessions, now, tz)).toBe(1);
  });

  it("uses local midnight for the day boundary", () => {
    // 23:30 local in New York on the 14th is 03:30 UTC on the 15th.
    const ny = "America/New_York";
    const nyNow = new Date("2026-06-15T15:00:00Z"); // the 15th in New York
    const sessions = ["2026-06-15T03:30:00Z", "2026-06-15T14:00:00Z"];
    expect(computeStreak(sessions, nyNow, ny)).toBe(2);
    expect(computeStreak(sessions, nyNow, "UTC")).toBe(1);
  });

  it("is not confused by daylight saving changes", () => {
    // London clocks go forward on 2026-03-29: 22:30Z that evening is 23:30 local.
    const sessions = ["2026-03-28T23:30:00Z", "2026-03-29T22:30:00Z", "2026-03-30T10:00:00Z"];
    expect(computeStreak(sessions, new Date("2026-03-30T12:00:00Z"), tz)).toBe(3);
  });

  it("falls back to UTC for an invalid timezone", () => {
    expect(computeStreak(["2026-06-15T08:00:00Z"], now, "Not/AZone")).toBe(1);
  });
});
