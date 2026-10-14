import { describe, expect, it } from "vitest";
import {
  MAX_REACHABLE_LEVEL,
  isCompleted,
  levelMinutes,
  nextLevel,
  targetSecondsForLevel,
  type LevelSession,
} from "./levels";

const good = (target: number): LevelSession => ({
  target_seconds: target,
  completed: true,
  fillers_per_minute: 3,
  words_per_minute: 120,
});

describe("ladder", () => {
  it("maps levels to minutes and clamps out-of-range levels", () => {
    expect(levelMinutes(1)).toBe(1);
    expect(levelMinutes(4)).toBe(5);
    expect(levelMinutes(11)).toBe(60);
    expect(levelMinutes(0)).toBe(1);
    expect(levelMinutes(99)).toBe(60);
    expect(levelMinutes(Number.NaN)).toBe(1);
  });

  it("clamps the effective target to five minutes", () => {
    expect(targetSecondsForLevel(1)).toBe(60);
    expect(targetSecondsForLevel(4)).toBe(300);
    expect(targetSecondsForLevel(11)).toBe(300);
    expect(MAX_REACHABLE_LEVEL).toBe(4);
  });
});

describe("isCompleted", () => {
  it("requires at least 80% of the target", () => {
    expect(isCompleted(48, 60)).toBe(true);
    expect(isCompleted(47.9, 60)).toBe(false);
    expect(isCompleted(10, 0)).toBe(false);
  });
});

describe("nextLevel", () => {
  it("levels up after three qualifying sessions in a row", () => {
    expect(nextLevel(1, [good(60), good(60), good(60)])).toBe(2);
  });

  it("needs three sessions", () => {
    expect(nextLevel(1, [good(60), good(60)])).toBe(1);
    expect(nextLevel(1, [])).toBe(1);
  });

  it("only looks at the most recent three sessions", () => {
    const bad = { ...good(60), fillers_per_minute: 6 };
    expect(nextLevel(1, [good(60), good(60), bad, good(60)])).toBe(1);
    expect(nextLevel(1, [good(60), good(60), good(60), bad])).toBe(2);
  });

  it("allows exactly four fillers per minute", () => {
    expect(nextLevel(2, [1, 2, 3].map(() => ({ ...good(120), fillers_per_minute: 4 })))).toBe(3);
  });

  it("does not count incomplete sessions", () => {
    expect(nextLevel(1, [good(60), { ...good(60), completed: false }, good(60)])).toBe(1);
  });

  it("does not count sessions from a previous level", () => {
    expect(nextLevel(2, [good(120), good(60), good(60)])).toBe(2);
  });

  it("does not level up beyond the effective cap", () => {
    expect(nextLevel(4, [good(300), good(300), good(300)])).toBe(4);
  });

  it("never levels down", () => {
    const bad = { target_seconds: 120, completed: false, fillers_per_minute: 20, words_per_minute: 30 };
    expect(nextLevel(2, [bad, bad, bad])).toBe(2);
  });

  it("does not count sessions that are too short to score", () => {
    const thin = { ...good(60), fillers_per_minute: 0, words_per_minute: 12 };
    expect(nextLevel(1, [good(60), thin, good(60)])).toBe(1);
    expect(nextLevel(1, [thin, thin, thin])).toBe(1);
  });

  it("treats exactly 60 words per minute as scorable", () => {
    expect(nextLevel(1, [1, 2, 3].map(() => ({ ...good(60), words_per_minute: 60 })))).toBe(2);
    expect(nextLevel(1, [1, 2, 3].map(() => ({ ...good(60), words_per_minute: 59.9 })))).toBe(1);
  });
});
