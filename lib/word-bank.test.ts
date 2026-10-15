import { describe, expect, it } from "vitest";
import { findUsedPhrases, normalisePhrase, pickPhrasesToSave } from "./word-bank";

describe("normalisePhrase", () => {
  it("trims, lowercases and collapses spaces", () => {
    expect(normalisePhrase("  Vivid ")).toBe("vivid");
    expect(normalisePhrase("In   a\tNutshell")).toBe("in a nutshell");
  });

  it("allows hyphens and apostrophes inside words, and straightens curly apostrophes", () => {
    expect(normalisePhrase("well-known")).toBe("well-known");
    expect(normalisePhrase("don’t")).toBe("don't");
    expect(normalisePhrase("rock-solid")).toBe("rock-solid");
  });

  it("accepts letters from other alphabets", () => {
    expect(normalisePhrase("café")).toBe("café");
  });

  it("rejects digits, punctuation and symbols", () => {
    expect(normalisePhrase("top 10")).toBeNull();
    expect(normalisePhrase("great!")).toBeNull();
    expect(normalisePhrase("this, that")).toBeNull();
    expect(normalisePhrase("a/b")).toBeNull();
    expect(normalisePhrase("<b>bold</b>")).toBeNull();
  });

  it("rejects separators at the ends or doubled", () => {
    expect(normalisePhrase("-vivid")).toBeNull();
    expect(normalisePhrase("vivid'")).toBeNull();
    expect(normalisePhrase("well--known")).toBeNull();
  });

  it("allows 1 to 4 words and at most 40 characters", () => {
    expect(normalisePhrase("one two three four")).toBe("one two three four");
    expect(normalisePhrase("one two three four five")).toBeNull();
    expect(normalisePhrase("a".repeat(40))).toBe("a".repeat(40));
    expect(normalisePhrase("a".repeat(41))).toBeNull();
  });

  it("rejects empty and non-string input", () => {
    expect(normalisePhrase("")).toBeNull();
    expect(normalisePhrase("   ")).toBeNull();
    expect(normalisePhrase(null)).toBeNull();
    expect(normalisePhrase(42)).toBeNull();
  });
});

describe("pickPhrasesToSave", () => {
  const upgrade = (you_said: string, ...try_instead: string[]) => ({ you_said, try_instead, why: "x" });

  it("takes the first alternative of each upgrade before any second ones", () => {
    const picked = pickPhrasesToSave([upgrade("good", "superb", "excellent"), upgrade("big", "vast")]);
    expect(picked.map((p) => p.phrase)).toEqual(["superb", "vast", "excellent"]);
    expect(picked[0].replaces).toBe("good");
  });

  it("saves at most 5", () => {
    const upgrades = ["a", "b", "c"].map((w) => upgrade(w, `${w}one`, `${w}two`, `${w}three`));
    expect(pickPhrasesToSave(upgrades)).toHaveLength(5);
  });

  it("skips invalid phrases and duplicates, case-insensitively", () => {
    const picked = pickPhrasesToSave([
      upgrade("nice", "Lovely", "top 10"),
      upgrade("pretty", "lovely", "charming!"),
      upgrade("big", "sprawling"),
    ]);
    expect(picked.map((p) => p.phrase)).toEqual(["lovely", "sprawling"]);
  });

  it("returns nothing for no upgrades", () => {
    expect(pickPhrasesToSave([])).toEqual([]);
  });
});

describe("findUsedPhrases", () => {
  it("matches whole words case-insensitively", () => {
    expect(findUsedPhrases("It was a VIVID dream.", ["vivid"])).toEqual(["vivid"]);
  });

  it("does not match inside longer words", () => {
    expect(findUsedPhrases("I remember it vividly.", ["vivid"])).toEqual([]);
    expect(findUsedPhrases("That was unvivid.", ["vivid"])).toEqual([]);
    expect(findUsedPhrases("We ate there.", ["eat"])).toEqual([]);
  });

  it("matches next to punctuation", () => {
    expect(findUsedPhrases("Sprawling, noisy, vivid.", ["sprawling", "vivid", "noisy"])).toEqual([
      "sprawling",
      "vivid",
      "noisy",
    ]);
    expect(findUsedPhrases('She said "superb"!', ["superb"])).toEqual(["superb"]);
    expect(findUsedPhrases("(vast)", ["vast"])).toEqual(["vast"]);
  });

  it("matches multi-word phrases across any whitespace", () => {
    expect(findUsedPhrases("So, in a\nnutshell, it works.", ["in a nutshell"])).toEqual(["in a nutshell"]);
    expect(findUsedPhrases("In a nut shell", ["in a nutshell"])).toEqual([]);
    expect(findUsedPhrases("within a nutshell", ["in a nutshell"])).toEqual([]);
  });

  it("handles apostrophes", () => {
    expect(findUsedPhrases("I don’t mind.", ["don't"])).toEqual(["don't"]);
    expect(findUsedPhrases("I don't mind.", ["don"])).toEqual([]);
    // A possessive still counts as using the word.
    expect(findUsedPhrases("The city's skyline.", ["city"])).toEqual(["city"]);
    expect(findUsedPhrases("The city’s skyline.", ["city"])).toEqual(["city"]);
    // Single quotes around a word don't block it.
    expect(findUsedPhrases("I'd call it 'vivid' really.", ["vivid"])).toEqual(["vivid"]);
  });

  it("handles hyphens", () => {
    expect(findUsedPhrases("A well-known fact.", ["well-known"])).toEqual(["well-known"]);
    expect(findUsedPhrases("A well-known fact.", ["known"])).toEqual([]);
    expect(findUsedPhrases("A well-known fact.", ["well"])).toEqual([]);
  });

  it("treats regex characters in phrases literally", () => {
    expect(findUsedPhrases("anything", ["a.*"])).toEqual([]);
  });

  it("returns each phrase once, in bank order, up to the limit", () => {
    expect(findUsedPhrases("vast vast vivid", ["vivid", "vast", "VAST"])).toEqual(["vivid", "vast"]);
    expect(findUsedPhrases("a b c", ["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });

  it("returns nothing for an empty transcript or bank", () => {
    expect(findUsedPhrases("", ["vivid"])).toEqual([]);
    expect(findUsedPhrases("vivid", [])).toEqual([]);
  });
});
