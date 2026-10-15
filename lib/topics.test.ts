import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  TOPICS,
  categoryLabel,
  getTopic,
  parseCategory,
  pickTopics,
  topicsInCategory,
} from "./topics";
import { TOPIC_CATEGORY_IDS, type CategoryChoice } from "./types";

/** Deterministic stand-in for crypto.randomInt. */
function seeded(seed: number) {
  let s = seed;
  return (max: number) => {
    s = (s * 48271) % 2147483647;
    return s % max;
  };
}

const first = () => 0;

describe("topic list", () => {
  it("has unique ids and unique texts", () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    expect(new Set(TOPICS.map((t) => t.text)).size).toBe(TOPICS.length);
  });

  it("keeps the original topic ids stable", () => {
    expect(getTopic("c001")?.text).toBe("Shoes");
    expect(getTopic("p050")?.text).toBe("How to get ready for work");
    expect(getTopic("o050")?.text).toBe("Is it better to plan or be spontaneous?");
  });

  it("gives every category around 20 topics across at least two tiers", () => {
    for (const id of TOPIC_CATEGORY_IDS) {
      const topics = topicsInCategory(id);
      expect(topics.length, id).toBeGreaterThanOrEqual(15);
      expect(topics.length, id).toBeLessThanOrEqual(30);
      expect(new Set(topics.map((t) => t.tier)).size, id).toBeGreaterThanOrEqual(2);
    }
  });

  it("offers Random first, then every category exactly once", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(["random", ...TOPIC_CATEGORY_IDS]);
    expect(categoryLabel("food")).toBe("Food");
    expect(categoryLabel(null)).toBeUndefined();
    expect(categoryLabel("nope")).toBeUndefined();
  });
});

describe("parseCategory", () => {
  it("accepts every listed id", () => {
    for (const c of CATEGORIES) expect(parseCategory(c.id)).toBe(c.id);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "Food", "food ", "FOOD", "sports", "random;drop", "__proto__", 1, null, undefined, ["food"], {}]) {
      expect(parseCategory(bad), String(bad)).toBeNull();
    }
  });
});

describe("pickTopics", () => {
  it("only returns topics from the chosen category", () => {
    for (const id of TOPIC_CATEGORY_IDS) {
      for (let seed = 1; seed <= 20; seed++) {
        const picked = pickTopics(id, [], 2, seeded(seed));
        expect(picked).toHaveLength(2);
        expect(picked.every((t) => t.category === id), id).toBe(true);
      }
    }
  });

  it("returns two different topics so the skip is a real alternative", () => {
    const [a, b] = pickTopics("science", [], 2, first);
    expect(a.id).not.toBe(b.id);
  });

  it("draws from every category for Random", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      for (const t of pickTopics("random", [], 2, seeded(seed))) seen.add(t.category);
    }
    expect(seen.size).toBe(TOPIC_CATEGORY_IDS.length);
  });

  it("never repeats one of the last 10 topics in the category", () => {
    const food = topicsInCategory("food");
    const recent = food.slice(0, 10).map((t) => t.text);
    for (let seed = 1; seed <= 50; seed++) {
      for (const t of pickTopics("food", recent, 2, seeded(seed))) {
        expect(recent).not.toContain(t.text);
      }
    }
  });

  it("falls back to the whole category, not other categories, when too few are left", () => {
    const health = topicsInCategory("health-habits");
    const allButOne = health.slice(1).map((t) => t.text);
    const picked = pickTopics("health-habits", allButOne, 2, seeded(7));
    expect(picked).toHaveLength(2);
    expect(picked.every((t) => t.category === "health-habits")).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(() => pickTopics("cooking" as CategoryChoice, [], 2, first)).toThrow();
    expect(() => pickTopics("" as CategoryChoice, [], 2, first)).toThrow();
  });
});
