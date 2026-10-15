export type Tint = "mint" | "peach" | "lavender" | "sky" | "butter";

/** Background, text and shadow classes for each tint (full class names so Tailwind sees them). */
export const TINT: Record<Tint, { bg: string; text: string; shadow: string; gradient: string }> = {
  mint: {
    bg: "bg-mint",
    text: "text-mint-ink",
    shadow: "shadow-mint",
    gradient: "bg-gradient-to-br from-mint to-[#d6eee0]",
  },
  peach: {
    bg: "bg-peach",
    text: "text-peach-ink",
    shadow: "shadow-peach",
    gradient: "bg-gradient-to-br from-peach to-[#ffe2cf]",
  },
  lavender: {
    bg: "bg-lavender",
    text: "text-lavender-ink",
    shadow: "shadow-lavender",
    gradient: "bg-gradient-to-br from-lavender to-[#e3ddfb]",
  },
  sky: {
    bg: "bg-sky",
    text: "text-sky-ink",
    shadow: "shadow-sky",
    gradient: "bg-gradient-to-br from-sky to-[#d8eaf7]",
  },
  butter: {
    bg: "bg-butter",
    text: "text-butter-ink",
    shadow: "shadow-butter",
    gradient: "bg-gradient-to-br from-butter to-[#fff0c2]",
  },
};

const CATEGORY_TINTS: Record<string, Tint> = {
  random: "mint",
  "animals-nature": "mint",
  food: "peach",
  technology: "sky",
  "money-work": "butter",
  "travel-places": "sky",
  "health-habits": "mint",
  "sports-games": "peach",
  "culture-society": "lavender",
  science: "lavender",
  "politics-issues": "butter",
  "everyday-life": "peach",
};

export function categoryTint(id: string | null | undefined): Tint {
  return (id && CATEGORY_TINTS[id]) || "mint";
}
