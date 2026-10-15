import type { VocabularyUpgrade } from "./types";

/** New words shown as "Words to try" on the home and session screens. */
export const WORDS_TO_TRY = 3;
/** Suggestions saved to the bank per session. */
export const MAX_SAVED_PER_SESSION = 5;
export const MAX_PHRASE_CHARS = 40;
export const MAX_PHRASE_WORDS = 4;
/** Matches recorded per session. The database function accepts up to 50. */
export const MAX_MATCHES_PER_SESSION = 20;

// Letters only, joined by single spaces, hyphens or apostrophes. No separator at either end.
const PHRASE_RE = /^\p{L}+(?:[ '-]\p{L}+)*$/u;

/** Lowercase, NFKC, straight apostrophes and plain hyphens, single spaces. */
function normaliseText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[‐‑]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** The phrase as stored in the bank, or null if it isn't a short, plain word or phrase. */
export function normalisePhrase(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const phrase = normaliseText(raw);
  if (phrase.length === 0 || phrase.length > MAX_PHRASE_CHARS) return null;
  if (!PHRASE_RE.test(phrase)) return null;
  if (phrase.split(" ").length > MAX_PHRASE_WORDS) return null;
  return phrase;
}

export type NewBankWord = { phrase: string; replaces: string };

/**
 * The suggestions to save: the first alternative of every upgrade, then the second,
 * and so on, so one upgrade can't take every slot. Invalid and repeated phrases are skipped.
 */
export function pickPhrasesToSave(
  upgrades: VocabularyUpgrade[],
  max: number = MAX_SAVED_PER_SESSION,
): NewBankWord[] {
  const picked: NewBankWord[] = [];
  const seen = new Set<string>();
  const rounds = Math.max(0, ...upgrades.map((u) => u.try_instead.length));

  for (let round = 0; round < rounds; round++) {
    for (const upgrade of upgrades) {
      if (picked.length >= max) return picked;
      const phrase = normalisePhrase(upgrade.try_instead[round]);
      if (!phrase || seen.has(phrase)) continue;
      seen.add(phrase);
      picked.push({ phrase, replaces: upgrade.you_said.trim().slice(0, 120) });
    }
  }
  return picked;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bank phrases the transcript contains as whole words, case-insensitively.
 * A letter or digit next to the phrase blocks a match, including across a hyphen or
 * apostrophe ("vivid" is not in "vividly", "known" is not in "well-known"), except a
 * possessive 's ("city" counts in "city's"). Returns unique phrases in bank order.
 */
export function findUsedPhrases(
  transcript: string,
  phrases: string[],
  max: number = MAX_MATCHES_PER_SESSION,
): string[] {
  const spoken = normaliseText(transcript);
  if (spoken.length === 0) return [];

  const found: string[] = [];
  const seen = new Set<string>();
  for (const raw of phrases) {
    if (found.length >= max) break;
    const phrase = normaliseText(raw);
    if (phrase.length === 0 || seen.has(phrase)) continue;
    seen.add(phrase);

    const body = escapeRegExp(phrase).replace(/ /g, "\\s+");
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}]['-]?)${body}(?:'s)?(?!['-]?[\\p{L}\\p{N}])`,
      "u",
    );
    if (pattern.test(spoken)) found.push(raw);
  }
  return found;
}
