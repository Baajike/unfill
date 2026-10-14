import { countFillers, findFillers } from "./fillers";
import type { Metrics, RepeatedWord, TimedSegment, TimedWord } from "./types";

export const LONG_PAUSE_SECONDS = 2;

// Deliberately small: enough to keep "the", "and", "is" out of vocabulary stats.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "of", "to", "in",
  "on", "at", "for", "with", "from", "by", "about", "as", "into", "up", "down",
  "out", "over", "is", "am", "are", "was", "were", "be", "been", "being", "do",
  "does", "did", "have", "has", "had", "will", "would", "can", "could", "should",
  "may", "might", "must", "i", "me", "my", "mine", "you", "your", "yours", "he",
  "him", "his", "she", "her", "hers", "it", "its", "we", "us", "our", "they",
  "them", "their", "this", "that", "these", "those", "there", "here", "what",
  "which", "who", "when", "where", "why", "how", "not", "no", "yes", "so", "just",
  "very", "too", "also", "all", "some", "any", "more", "most", "really", "get",
  "got", "go", "going", "i'm", "it's", "don't", "that's", "there's", "can't",
  "i've", "i'll", "you're", "they're", "we're", "isn't", "didn't", "doesn't",
]);

const WORD_RE = /[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu;

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/’/g, "'").match(WORD_RE) ?? [];
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function perMinute(count: number, durationSeconds: number): number {
  return durationSeconds > 0 ? round(count / (durationSeconds / 60), 1) : 0;
}

function removeFillers(text: string): string {
  let result = "";
  let cursor = 0;
  for (const m of findFillers(text)) {
    result += text.slice(cursor, m.start) + " ";
    cursor = m.end;
  }
  return result + text.slice(cursor);
}

export function countLongPauses(
  words: TimedWord[] | null,
  segments: TimedSegment[] | null,
  thresholdSeconds = LONG_PAUSE_SECONDS,
): number | null {
  const spans = words && words.length > 0 ? words : segments && segments.length > 0 ? segments : null;
  if (!spans) return null;
  let pauses = 0;
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start - spans[i - 1].end > thresholdSeconds) pauses++;
  }
  return pauses;
}

export function computeMetrics(input: {
  text: string;
  durationSeconds: number;
  words?: TimedWord[] | null;
  segments?: TimedSegment[] | null;
}): Metrics {
  const duration = Number.isFinite(input.durationSeconds) ? Math.max(0, input.durationSeconds) : 0;
  const wordCount = tokenize(input.text).length;
  const fillers = countFillers(input.text);

  const contentWords = tokenize(removeFillers(input.text)).filter((w) => !STOPWORDS.has(w));
  const counts = new Map<string, number>();
  for (const w of contentWords) counts.set(w, (counts.get(w) ?? 0) + 1);

  const topRepeated: RepeatedWord[] = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  return {
    duration_seconds: round(duration, 1),
    word_count: wordCount,
    words_per_minute: perMinute(wordCount, duration),
    filler_count: fillers.total,
    fillers_per_minute: perMinute(fillers.total, duration),
    filler_breakdown: fillers.breakdown,
    unique_word_ratio: contentWords.length > 0 ? round(counts.size / contentWords.length, 2) : 0,
    top_repeated: topRepeated,
    long_pauses: countLongPauses(input.words ?? null, input.segments ?? null),
  };
}
