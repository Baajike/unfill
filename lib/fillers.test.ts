import { describe, expect, it } from "vitest";
import { countFillers, findFillers } from "./fillers";

describe("findFillers", () => {
  it("returns nothing for an empty transcript", () => {
    expect(findFillers("")).toEqual([]);
    expect(countFillers("   ").total).toBe(0);
  });

  it("matches case-insensitively and through punctuation", () => {
    const { total, breakdown } = countFillers("Um, I think... UH. Basically, yes!");
    expect(total).toBe(3);
    expect(breakdown).toEqual({ um: 1, uh: 1, basically: 1 });
  });

  it("does not match fillers inside other words", () => {
    const text = "It is likely they liked the unlike umbrella, so-called errand, ahead of hummus.";
    expect(findFillers(text).map((m) => m.filler)).toEqual([]);
  });

  it("matches multi-word fillers once, not as separate words", () => {
    const { total, breakdown } = countFillers(
      "You know, I mean it was kind of, sort of fun, you  know?",
    );
    expect(breakdown).toEqual({ "you know": 2, "I mean": 1, "kind of": 1, "sort of": 1 });
    expect(total).toBe(5);
  });

  it("does not match partial phrases", () => {
    expect(countFillers("I meant what you knowingly said, kindly").total).toBe(0);
  });

  it("folds elongated hesitations into the base filler", () => {
    const { breakdown } = countFillers("Umm, uhh, hmmm, erm, err, ahh, uhm");
    expect(breakdown).toEqual({ um: 2, uh: 1, hmm: 1, erm: 1, er: 1, ah: 1 });
  });

  it("counts repeated adjacent fillers", () => {
    expect(countFillers("um um um").total).toBe(3);
    expect(countFillers("like like").total).toBe(2);
  });

  it("only counts 'so' at the start of a sentence", () => {
    const text = "So I went out. It was so cold! So, anyway? And so on. \"So what\" she said.";
    const so = findFillers(text).filter((m) => m.filler === "so");
    expect(so).toHaveLength(3);
    for (const m of so) expect(text.slice(m.start, m.end).toLowerCase()).toBe("so");
  });

  it("does not treat 'sorry' or 'some' at sentence start as 'so'", () => {
    expect(countFillers("Sorry. Some people. Sofa.").total).toBe(0);
  });

  it("returns correct offsets for highlighting, sorted", () => {
    const text = "So, like, you know.";
    const matches = findFillers(text);
    expect(matches.map((m) => text.slice(m.start, m.end))).toEqual(["So", "like", "you know"]);
  });

  it("handles apostrophes and curly quotes as word characters", () => {
    expect(countFillers("I’d like’s um").breakdown).toEqual({ um: 1 });
  });
});
