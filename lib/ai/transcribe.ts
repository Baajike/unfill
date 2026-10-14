import "server-only";
import { whisperResponseSchema } from "@/lib/validation";
import type { Transcript } from "@/lib/types";

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";
const TIMEOUT_MS = 90_000;

// Whisper copies the style of its prompt. A prompt full of disfluencies stops it
// from "cleaning up" the hesitations this app exists to measure.
const DISFLUENT_PROMPT =
  "Umm, so, uh, I was like, you know, thinking about it, hmm, and I mean, basically... " +
  "Er, it's kind of, sort of, uh, actually, literally, like, umm, you know?";

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
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

/** Audio stays in memory: it is streamed to Groq and never written anywhere. */
export async function transcribe(audio: File): Promise<Transcript> {
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

  return {
    text: text.trim(),
    durationSeconds: duration ?? lastEnd,
    words: words && words.length > 0 ? words : null,
    segments: segments && segments.length > 0 ? segments : null,
  };
}
