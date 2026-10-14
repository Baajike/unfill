export const FILLERS = [
  "um",
  "uh",
  "erm",
  "er",
  "hmm",
  "ah",
  "like",
  "you know",
  "I mean",
  "basically",
  "actually",
  "literally",
  "kind of",
  "sort of",
  "so",
] as const;

export type Filler = (typeof FILLERS)[number];

export type FillerMatch = {
  filler: Filler;
  /** Character offsets into the original text, end exclusive. */
  start: number;
  end: number;
};

// Order matters: multi-word phrases first, and "um"/"erm" before "uh"/"er" so
// "uhm" and "erm" are not split. Whisper writes hesitations with extra letters
// ("Umm", "Uhh", "Hmmm"), so those are folded into the base filler.
// "so" is handled separately because it only counts at the start of a sentence.
const PATTERNS: ReadonlyArray<readonly [Filler, string]> = [
  ["you know", "you\\s+know"],
  ["I mean", "i\\s+mean"],
  ["kind of", "kind\\s+of"],
  ["sort of", "sort\\s+of"],
  ["basically", "basically"],
  ["actually", "actually"],
  ["literally", "literally"],
  ["like", "like"],
  ["um", "u+h?m+"],
  ["uh", "u+h+"],
  ["erm", "e+r+m+"],
  ["er", "e+r+"],
  ["hmm", "h+m+"],
  ["ah", "a+h+"],
];

// Lookbehind is avoided on purpose: iOS 16.0–16.3 Safari cannot parse it.
const WORD_CHAR = "[\\p{L}\\p{N}'’]";
const FILLER_SOURCE = `(^|[^\\p{L}\\p{N}'’])(?:${PATTERNS.map(([, p]) => `(${p})`).join("|")})(?!${WORD_CHAR})`;
const SENTENCE_SO_SOURCE = `(^\\s*["'“‘(]*|[.!?…]["'”’)\\]]*\\s+["'“‘(]*)(so)(?!${WORD_CHAR})`;

export function findFillers(text: string): FillerMatch[] {
  const matches: FillerMatch[] = [];

  const fillerRe = new RegExp(FILLER_SOURCE, "giu");
  let m: RegExpExecArray | null;
  while ((m = fillerRe.exec(text)) !== null) {
    const prefix = m[1] ?? "";
    const groupIndex = m.slice(2).findIndex((g) => g !== undefined);
    const matched = m[groupIndex + 2];
    const start = m.index + prefix.length;
    matches.push({ filler: PATTERNS[groupIndex][0], start, end: start + matched.length });
    // The prefix consumed a separator character; step back so the next match
    // can use the same separator (e.g. "um um").
    fillerRe.lastIndex = start + matched.length;
  }

  const soRe = new RegExp(SENTENCE_SO_SOURCE, "giu");
  while ((m = soRe.exec(text)) !== null) {
    const start = m.index + m[1].length;
    matches.push({ filler: "so", start, end: start + 2 });
    soRe.lastIndex = start + 2;
  }

  return matches.sort((a, b) => a.start - b.start);
}

export function countFillers(text: string): {
  total: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {};
  const matches = findFillers(text);
  for (const { filler } of matches) {
    breakdown[filler] = (breakdown[filler] ?? 0) + 1;
  }
  return { total: matches.length, breakdown };
}
