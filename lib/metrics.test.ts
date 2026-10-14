import { describe, expect, it } from "vitest";
import { computeMetrics, countLongPauses, isTooShortToScore, tokenize } from "./metrics";

describe("isTooShortToScore", () => {
  it("flags sessions under 60 words per minute", () => {
    expect(isTooShortToScore({ words_per_minute: 0 })).toBe(true);
    expect(isTooShortToScore({ words_per_minute: 59.9 })).toBe(true);
    expect(isTooShortToScore({ words_per_minute: 60 })).toBe(false);
    expect(isTooShortToScore({ words_per_minute: 140 })).toBe(false);
  });

  it("catches a full-length recording that only captured the first few seconds", () => {
    // 60 s of audio, but speech only for the first ~4 s.
    const m = computeMetrics({ text: "So, um, shoes are something I wear every single day.", durationSeconds: 60 });
    expect(m.words_per_minute).toBe(10);
    expect(isTooShortToScore(m)).toBe(true);
  });

  it("treats an empty transcript as too short", () => {
    expect(isTooShortToScore(computeMetrics({ text: "", durationSeconds: 60 }))).toBe(true);
  });
});

describe("tokenize", () => {
  it("keeps contractions and drops punctuation", () => {
    expect(tokenize("I’m here, aren't you? Yes!")).toEqual(["i'm", "here", "aren't", "you", "yes"]);
  });

  it("returns an empty list for empty or punctuation-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("... !!! ,")).toEqual([]);
  });
});

describe("computeMetrics", () => {
  it("handles an empty transcript without dividing by zero", () => {
    const m = computeMetrics({ text: "", durationSeconds: 60 });
    expect(m).toEqual({
      duration_seconds: 60,
      word_count: 0,
      words_per_minute: 0,
      filler_count: 0,
      fillers_per_minute: 0,
      filler_breakdown: {},
      unique_word_ratio: 0,
      top_repeated: [],
      long_pauses: null,
    });
  });

  it("handles zero or invalid duration", () => {
    expect(computeMetrics({ text: "hello there", durationSeconds: 0 }).words_per_minute).toBe(0);
    expect(computeMetrics({ text: "hello", durationSeconds: Number.NaN }).duration_seconds).toBe(0);
  });

  it("computes words and fillers per minute", () => {
    const text = "Um, I like bread. You know, bread is great. So, uh, bread.";
    const m = computeMetrics({ text, durationSeconds: 30 });
    expect(m.word_count).toBe(12);
    expect(m.words_per_minute).toBe(24);
    expect(m.filler_breakdown).toEqual({ um: 1, like: 1, "you know": 1, so: 1, uh: 1 });
    expect(m.filler_count).toBe(5);
    expect(m.fillers_per_minute).toBe(10);
  });

  it("excludes fillers and stopwords from vocabulary stats", () => {
    const m = computeMetrics({
      text: "Basically the bread is good. Like, the bread is basically good bread.",
      durationSeconds: 60,
    });
    // Content words: bread, good, bread, good, bread
    expect(m.unique_word_ratio).toBe(0.4);
    expect(m.top_repeated).toEqual([
      { word: "bread", count: 3 },
      { word: "good", count: 2 },
    ]);
  });

  it("does not treat words containing fillers as fillers", () => {
    const m = computeMetrics({ text: "It will likely rain, literally.", durationSeconds: 60 });
    expect(m.filler_breakdown).toEqual({ literally: 1 });
    expect(m.unique_word_ratio).toBe(1);
  });

  it("limits top repeated words to five, sorted by count then alphabetically", () => {
    const text = "apple apple banana banana cherry cherry date date egg egg fig fig fig";
    const m = computeMetrics({ text, durationSeconds: 60 });
    expect(m.top_repeated.map((r) => r.word)).toEqual(["fig", "apple", "banana", "cherry", "date"]);
  });
});

describe("countLongPauses", () => {
  const w = (start: number, end: number) => ({ word: "x", start, end });

  it("returns null when there are no timestamps", () => {
    expect(countLongPauses(null, null)).toBeNull();
    expect(countLongPauses([], [])).toBeNull();
  });

  it("counts gaps strictly longer than two seconds between words", () => {
    expect(countLongPauses([w(0, 1), w(3, 3.5), w(5.6, 6), w(6.1, 7)], null)).toBe(1);
  });

  it("falls back to segment timestamps", () => {
    const segments = [
      { text: "a", start: 0, end: 4 },
      { text: "b", start: 7, end: 9 },
    ];
    expect(countLongPauses(null, segments)).toBe(1);
  });
});
