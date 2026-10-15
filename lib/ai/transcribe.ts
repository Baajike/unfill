import "server-only";
import { tokenize } from "@/lib/metrics";
import { whisperResponseSchema, type WhisperSegment } from "@/lib/validation";
import type { TimedWord, Transcript } from "@/lib/types";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";
const TIMEOUT_MS = 90_000;

// Whisper copies the style of its prompt. A prompt full of disfluencies stops it
// from "cleaning up" the hesitations this app exists to measure.
const DISFLUENT_PROMPT =
  "Umm, so, uh, I was like, you know, thinking about it, hmm, and I mean, basically... " +
  "Er, it's kind of, sort of, uh, actually, literally, like, umm, you know?";

// Hallucination guards. On silence or noise Whisper invents text: credits from its
// training subtitles, or a copy of the prompt. These thresholds are conservative.
export const NO_SPEECH_DROP = 0.8;
export const LOGPROB_DROP = -1.5;
export const NO_SPEECH_SOFT = 0.5;
export const LOGPROB_SOFT = -1.0;
export const COMPRESSION_RATIO_DROP = 2.4;
export const PROMPT_ECHO_MIN_RUN = 4;
export const PROMPT_ECHO_MIN_SHARE = 0.6;
export const PROMPT_ECHO_NO_SPEECH = 0.3;
export const MIN_SPEECH_WORDS = 5;

const HALLUCINATION_PHRASES = [
  "amara.org",
  "subtitles by",
  "subtitled by",
  "captions by",
  "transcribed by",
  "thanks for watching",
  "thank you for watching",
  "please subscribe",
  "like and subscribe",
];

export type DropReason = "phrase" | "no_speech" | "low_confidence" | "repetition" | "prompt_echo";

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

/** The audio had no usable speech once hallucinations were removed. */
export class NoSpeechError extends Error {
  constructor(readonly dropped: Partial<Record<DropReason, number>>) {
    super("No speech detected");
    this.name = "NoSpeechError";
  }
}

const PROMPT_WORDS = tokenize(DISFLUENT_PROMPT);
const PROMPT_WORD_SET = new Set(PROMPT_WORDS);
const PROMPT_RUNS = new Set(
  PROMPT_WORDS.slice(0, PROMPT_WORDS.length - PROMPT_ECHO_MIN_RUN + 1).map((_, i) =>
    PROMPT_WORDS.slice(i, i + PROMPT_ECHO_MIN_RUN).join(" "),
  ),
);

/**
 * A segment counts as a prompt copy only if it repeats a run of the prompt word
 * for word AND is mostly prompt words or probably not speech. A real speaker
 * saying "I was like, you know" in a longer sentence is kept.
 */
function isPromptEcho(segment: WhisperSegment): boolean {
  const words = tokenize(segment.text);
  if (words.length < PROMPT_ECHO_MIN_RUN) return false;
  let copiesRun = false;
  for (let i = 0; i + PROMPT_ECHO_MIN_RUN <= words.length && !copiesRun; i++) {
    copiesRun = PROMPT_RUNS.has(words.slice(i, i + PROMPT_ECHO_MIN_RUN).join(" "));
  }
  if (!copiesRun) return false;
  const share = words.filter((w) => PROMPT_WORD_SET.has(w)).length / words.length;
  return share >= PROMPT_ECHO_MIN_SHARE || (segment.no_speech_prob ?? 0) > PROMPT_ECHO_NO_SPEECH;
}

function dropReason(segment: WhisperSegment): DropReason | null {
  const lower = segment.text.toLowerCase();
  if (HALLUCINATION_PHRASES.some((p) => lower.includes(p))) return "phrase";
  const noSpeech = segment.no_speech_prob ?? 0;
  const logprob = segment.avg_logprob ?? 0;
  if (noSpeech >= NO_SPEECH_DROP) return "no_speech";
  if (logprob <= LOGPROB_DROP || (noSpeech > NO_SPEECH_SOFT && logprob < LOGPROB_SOFT)) {
    return "low_confidence";
  }
  if ((segment.compression_ratio ?? 0) > COMPRESSION_RATIO_DROP) return "repetition";
  if (isPromptEcho(segment)) return "prompt_echo";
  return null;
}

export type FilteredTranscript = {
  text: string;
  words: TimedWord[] | null;
  segments: WhisperSegment[] | null;
  dropped: Partial<Record<DropReason, number>>;
};

/** Removes hallucinated segments, and the word timestamps that belonged to them. */
export function filterHallucinations(input: {
  text: string;
  words: TimedWord[] | null;
  segments: WhisperSegment[] | null;
}): FilteredTranscript {
  if (!input.segments || input.segments.length === 0) {
    // Nothing to judge per segment; only the phrase list can apply.
    const lower = input.text.toLowerCase();
    return HALLUCINATION_PHRASES.some((p) => lower.includes(p))
      ? { text: "", words: null, segments: null, dropped: { phrase: 1 } }
      : { ...input, text: input.text.trim(), dropped: {} };
  }

  const dropped: Partial<Record<DropReason, number>> = {};
  const kept = input.segments.filter((segment) => {
    const reason = dropReason(segment);
    if (reason) dropped[reason] = (dropped[reason] ?? 0) + 1;
    return reason === null;
  });

  const words = input.words?.filter((w) => {
    const mid = (w.start + w.end) / 2;
    return kept.some((s) => mid >= s.start && mid <= s.end);
  });

  return {
    text: kept
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(" "),
    words: words && words.length > 0 ? words : null,
    segments: kept.length > 0 ? kept : null,
    dropped,
  };
}

async function requestTranscription(audio: File, withWordTimestamps: boolean) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new TranscriptionError("GROQ_API_KEY is not set");

  const form = new FormData();
  form.append("file", audio);
  form.append("model", MODEL);
  form.append("prompt", DISFLUENT_PROMPT);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  form.append("language", "en");
  if (withWordTimestamps) {
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
  }

  return fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

/**
 * Audio stays in memory: it is streamed to Groq and never written anywhere.
 * Throws NoSpeechError when nothing real is left after removing hallucinations.
 */
export async function transcribe(
  audio: File,
): Promise<Transcript & { dropped: FilteredTranscript["dropped"] }> {
  let res = await requestTranscription(audio, true);
  if (res.status === 400) {
    // Word timestamps may not be supported; segment timestamps come with verbose_json.
    res = await requestTranscription(audio, false);
  }
  if (!res.ok) {
    throw new TranscriptionError("Transcription request failed", res.status);
  }

  const parsed = whisperResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new TranscriptionError("Unexpected transcription response shape");
  }

  const { text, duration, words, segments } = parsed.data;
  const lastEnd = words?.at(-1)?.end ?? segments?.at(-1)?.end ?? 0;

  const filtered = filterHallucinations({
    text,
    words: words && words.length > 0 ? words : null,
    segments: segments && segments.length > 0 ? segments : null,
  });
  if (tokenize(filtered.text).length < MIN_SPEECH_WORDS) {
    throw new NoSpeechError(filtered.dropped);
  }

  return {
    text: filtered.text,
    // The real audio length, even if trailing segments were dropped.
    durationSeconds: duration ?? lastEnd,
    words: filtered.words,
    segments: filtered.segments,
    dropped: filtered.dropped,
  };
}
