import { countFillers, findFillers } from "./fillers";
import type { Metrics, RepeatedWord, TimedSegment, TimedWord } from "./types";

export const LONG_PAUSE_SECONDS = 2;

/**
 * Below this pace the transcript is too thin to judge (often a capture problem,
 * not the speaker), so the session isn't scored, compared or counted for level-up.
 */
export const MIN_SCORABLE_WPM = 60;

export function isTooShortToScore(metrics: Pick<Metrics, "words_per_minute">): boolean {
  return metrics.words_per_minute < MIN_SCORABLE_WPM;
}

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

// ---------------------------------------------------------------------------
// Audio loudness, used in the browser to refuse silent recordings before upload.
// ---------------------------------------------------------------------------

export const ACTIVITY_WINDOW_SECONDS = 0.05;
/** A 50 ms window louder than this counts as sound (speech is usually -30 to -10 dBFS). */
export const ACTIVE_WINDOW_DBFS = -45;
/** Below this share of sounding windows, a recording is treated as silent. */
export const MIN_ACTIVE_RATIO = 0.01;

export function rmsToDbfs(rms: number): number {
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

export function rootMeanSquare(samples: ArrayLike<number>, start = 0, end = samples.length): number {
  const n = end - start;
  if (n <= 0) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / n);
}

export type AudioActivity = { windows: number; activeRatio: number; peakDbfs: number };

export function measureActivity(samples: ArrayLike<number>, sampleRate: number): AudioActivity {
  const size = Math.max(1, Math.round(sampleRate * ACTIVITY_WINDOW_SECONDS));
  const windows = Math.floor(samples.length / size);
  let active = 0;
  let peak = -Infinity;
  for (let w = 0; w < windows; w++) {
    const db = rmsToDbfs(rootMeanSquare(samples, w * size, (w + 1) * size));
    if (db > ACTIVE_WINDOW_DBFS) active++;
    if (db > peak) peak = db;
  }
  return { windows, activeRatio: windows > 0 ? active / windows : 0, peakDbfs: peak };
}

export function isEssentiallySilent(activity: AudioActivity): boolean {
  return activity.windows === 0 || activity.activeRatio < MIN_ACTIVE_RATIO;
}
