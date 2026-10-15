import { z } from "zod";
import { TOPIC_CATEGORY_IDS, type CategoryChoice, type Feedback, type Metrics } from "./types";

/** Groq's Whisper limit. On Vercel the platform's 4.5 MB body cap applies first. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
] as const;

/** "audio/webm;codecs=opus" -> "audio/webm" */
export function baseMimeType(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

export function isAllowedAudioType(type: string): boolean {
  return (ALLOWED_AUDIO_TYPES as readonly string[]).includes(baseMimeType(type));
}

export function extensionForMimeType(type: string): string {
  switch (baseMimeType(type)) {
    case "audio/webm":
      return "webm";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
      return "wav";
    default:
      return "m4a";
  }
}

/** Checks the file's magic bytes so the declared type can't be spoofed freely. */
export function looksLikeAudio(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  return (
    (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) || // WebM / Matroska
    ascii(4, 8) === "ftyp" || // MP4 / M4A
    ascii(0, 4) === "OggS" ||
    (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") ||
    ascii(0, 3) === "ID3" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) // MPEG / ADTS frame sync
  );
}

const text = (max: number) => z.string().trim().min(1).max(max);

const upgradeSchema = z.object({
  you_said: text(120),
  try_instead: z.array(text(60)).min(1).max(4),
  why: text(240),
});

/** What the LLM must return. */
export const feedbackSchema = z.object({
  summary: text(400),
  did_well: text(400),
  focus_next: text(400),
  vocabulary_upgrades: z.array(upgradeSchema).min(3).max(5),
  filler_tip: text(400),
}) satisfies z.ZodType<Feedback>;

/** What we read back from the database: upgrades not found in the transcript were dropped before saving. */
export const storedFeedbackSchema = feedbackSchema.extend({
  vocabulary_upgrades: z.array(upgradeSchema).max(5),
}) satisfies z.ZodType<Feedback>;

export const metricsSchema = z.object({
  duration_seconds: z.number(),
  word_count: z.number(),
  words_per_minute: z.number(),
  filler_count: z.number(),
  fillers_per_minute: z.number(),
  filler_breakdown: z.record(z.string(), z.number()),
  unique_word_ratio: z.number(),
  top_repeated: z.array(z.object({ word: z.string(), count: z.number() })),
  long_pauses: z.number().nullable(),
  bank_words_used: z.array(z.string().max(40)).max(50).optional(),
}) satisfies z.ZodType<Metrics>;

const timed = z.object({ start: z.number(), end: z.number() });

export const whisperResponseSchema = z.object({
  text: z.string(),
  duration: z.number().optional(),
  words: z.array(timed.extend({ word: z.string() })).nullish(),
  segments: z
    .array(
      timed.extend({
        text: z.string(),
        // Whisper's per-segment confidence scores, used to drop hallucinated text.
        no_speech_prob: z.number().optional(),
        avg_logprob: z.number().optional(),
        compression_ratio: z.number().optional(),
      }),
    )
    .nullish(),
});

export type WhisperSegment = NonNullable<z.infer<typeof whisperResponseSchema>["segments"]>[number];

export const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(72),
});

export const uuidSchema = z.uuid();

/** The word id posted by the Dismiss form on /words. */
export const wordIdSchema = uuidSchema;

/** A category id from the home screen. Anything not on the fixed list is rejected. */
export const categoryChoiceSchema = z.enum(["random", ...TOPIC_CATEGORY_IDS]) satisfies z.ZodType<CategoryChoice>;
