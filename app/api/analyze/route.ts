import { NextResponse } from "next/server";
import { generateFeedback } from "@/lib/ai/feedback";
import { NoSpeechError, TranscriptionError, transcribe } from "@/lib/ai/transcribe";
import {
  MIN_RECORDING_SECONDS,
  isCompleted,
  nextLevel,
  targetSecondsForLevel,
} from "@/lib/levels";
import { computeMetrics } from "@/lib/metrics";
import { checkDailyLimit } from "@/lib/rate-limit";
import { getUser } from "@/lib/supabase/server";
import { getTopic } from "@/lib/topics";
import type { Feedback } from "@/lib/types";
import {
  MAX_AUDIO_BYTES,
  baseMimeType,
  extensionForMimeType,
  isAllowedAudioType,
  looksLikeAudio,
  metricsSchema,
} from "@/lib/validation";
import { findUsedPhrases, pickPhrasesToSave } from "@/lib/word-bank";

export const maxDuration = 120;

type SupabaseServerClient = Awaited<ReturnType<typeof getUser>>["supabase"];

// Bounded so the match stays cheap even for a very large bank.
const BANK_LOOKUP_LIMIT = 500;

// Whisper measures duration slightly differently from the browser clock.
const DURATION_TOLERANCE_SECONDS = 2;
const MAX_TRANSCRIPT_CHARS = 50_000;

function fail(status: number, error: string, code?: string) {
  return NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "no-store" } });
}

/** e.g. "phrase:1,no_speech:2" — counts only, never text. */
function formatDropped(dropped: Record<string, number | undefined>): string {
  const parts = Object.entries(dropped).map(([reason, n]) => `${reason}:${n}`);
  return parts.length > 0 ? parts.join(",") : "none";
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getUser();
    if (!user) return fail(401, "Please sign in again.");

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return fail(415, "Unsupported upload.");
    }
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_AUDIO_BYTES + 64 * 1024) {
      return fail(413, "That recording is too large.");
    }

    const limit = await checkDailyLimit(supabase, user.id);
    if (!limit.allowed) {
      return fail(429, "You've reached today's limit. Come back tomorrow.");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, "Unsupported upload.");
    }

    const audio = form.get("audio");
    const topic = getTopic(form.get("topicId"));
    if (!(audio instanceof Blob) || !topic) return fail(400, "Unsupported upload.");
    if (!isAllowedAudioType(audio.type)) return fail(415, "Unsupported audio format.");
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return fail(413, "That recording is too large.");
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    if (!looksLikeAudio(bytes)) return fail(415, "Unsupported audio format.");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_level")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) throw new Error("Profile lookup failed");

    // The target comes from the server-side level, never from the client.
    const level = profile.current_level;
    const targetSeconds = targetSecondsForLevel(level);

    const mime = baseMimeType(audio.type);
    const file = new File([bytes], `recording.${extensionForMimeType(mime)}`, { type: mime });
    const transcript = await transcribe(file);

    // One diagnostic line: counts and timings only, never transcript text. If speech
    // ends long before the audio does, the capture or the decoder lost audio.
    const lastSpeechAt = transcript.words?.at(-1)?.end ?? transcript.segments?.at(-1)?.end ?? null;
    console.info(
      `[analyze] audio=${mime} bytes=${bytes.length} duration=${transcript.durationSeconds.toFixed(1)}s ` +
        `words=${transcript.words?.length ?? transcript.text.split(/\s+/).filter(Boolean).length} ` +
        `lastSpeechAt=${lastSpeechAt === null ? "n/a" : `${lastSpeechAt.toFixed(1)}s`} ` +
        `timestamps=${transcript.words ? "word" : transcript.segments ? "segment" : "none"} ` +
        `dropped=${formatDropped(transcript.dropped)}`,
    );

    // Duration comes from the audio itself, so it can't be inflated by the client.
    const duration = Math.min(transcript.durationSeconds, targetSeconds + 5);
    if (duration < MIN_RECORDING_SECONDS - DURATION_TOLERANCE_SECONDS) {
      return fail(422, "That recording was shorter than 30 seconds.");
    }
    if (transcript.text.length === 0) {
      return fail(422, "We couldn't hear any speech. Check your microphone and try again.");
    }
    const text = transcript.text.slice(0, MAX_TRANSCRIPT_CHARS);

    const metrics = computeMetrics({
      text,
      durationSeconds: duration,
      words: transcript.words,
      segments: transcript.segments,
    });
    const { feedback, source } = await generateFeedback({ transcript: text, metrics, topic });

    // Checked against the bank as it was before this session's suggestions are added.
    const bankWordsUsed = await findBankWordsUsed(supabase, user.id, text);

    const { data: saved, error: insertError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        topic: topic.text,
        topic_tier: topic.tier,
        // From the server-side topic list, never from the client.
        topic_category: topic.category,
        target_seconds: targetSeconds,
        duration_seconds: metrics.duration_seconds,
        completed: isCompleted(duration, targetSeconds),
        transcript: text,
        metrics: bankWordsUsed.length > 0 ? { ...metrics, bank_words_used: bankWordsUsed } : metrics,
        feedback,
        feedback_source: source,
      })
      .select("id")
      .single();
    if (insertError || !saved) throw new Error("Session insert failed");

    await updateWordBank(supabase, user.id, saved.id, bankWordsUsed, feedback);
    await maybeLevelUp(supabase, user.id, level);

    return NextResponse.json({ id: saved.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Log the kind of failure only. Never transcripts, audio or keys.
    if (error instanceof NoSpeechError) {
      // Nothing is saved, so this doesn't use up the daily limit.
      console.info(`[analyze] no speech detected: dropped=${formatDropped(error.dropped)}`);
      return fail(422, "No speech detected. Check your microphone and try again.", "no_speech");
    }
    if (error instanceof TranscriptionError) {
      console.error(`[analyze] transcription failed: status ${error.status ?? "n/a"}`);
      return fail(502, "We couldn't process that recording. Please try again.");
    }
    // Only our own plain Errors carry a message we wrote; others (e.g. a JSON
    // SyntaxError) can quote response bodies, so log just their type.
    const detail =
      error instanceof Error ? (error.constructor === Error ? error.message : error.name) : "unknown";
    console.error(`[analyze] failed: ${detail}`);
    return fail(500, "Something went wrong. Please try again.");
  }
}

/** Bank phrases (new or used) said in this transcript. Never throws; [] on any error. */
async function findBankWordsUsed(
  supabase: SupabaseServerClient,
  userId: string,
  transcript: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("word_bank")
      .select("phrase")
      .eq("user_id", userId)
      .in("status", ["new", "used"])
      .order("created_at", { ascending: true })
      .limit(BANK_LOOKUP_LIMIT);
    if (error) {
      console.warn("[word-bank] lookup failed");
      return [];
    }
    return findUsedPhrases(transcript, (data ?? []).map((w) => w.phrase));
  } catch {
    console.warn("[word-bank] lookup failed");
    return [];
  }
}

/**
 * Counts the words used in this session, then saves its new suggestions.
 * Never throws: the session is already saved. Logs counts only, never words.
 */
async function updateWordBank(
  supabase: SupabaseServerClient,
  userId: string,
  sessionId: string,
  used: string[],
  feedback: Feedback | null,
) {
  let recorded = 0;
  let submitted = 0;
  try {
    if (used.length > 0) {
      // The database function re-checks ownership and the transcript itself.
      const { data, error } = await supabase.rpc("record_word_use", {
        p_session_id: sessionId,
        p_phrases: used,
      });
      if (error) console.warn("[word-bank] record use failed");
      else recorded = data ?? 0;
    }

    const words = pickPhrasesToSave(feedback?.vocabulary_upgrades ?? []);
    if (words.length > 0) {
      const { error } = await supabase.from("word_bank").upsert(
        words.map((w) => ({
          user_id: userId,
          phrase: w.phrase,
          replaces: w.replaces,
          source_session_id: sessionId,
        })),
        { onConflict: "user_id,phrase_key", ignoreDuplicates: true },
      );
      if (error) console.warn("[word-bank] save failed");
      else submitted = words.length;
    }
  } catch {
    console.warn("[word-bank] update failed");
  }
  console.info(`[word-bank] matched=${used.length} recorded=${recorded} submitted=${submitted}`);
}

async function maybeLevelUp(
  supabase: SupabaseServerClient,
  userId: string,
  level: number,
) {
  const { data: recent } = await supabase
    .from("sessions")
    .select("target_seconds, completed, metrics")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  const sessions = (recent ?? []).map((s) => {
    const m = metricsSchema.safeParse(s.metrics).data;
    return {
      target_seconds: s.target_seconds,
      completed: s.completed,
      // Unreadable metrics never qualify.
      fillers_per_minute: m?.fillers_per_minute ?? Infinity,
      words_per_minute: m?.words_per_minute ?? 0,
    };
  });

  if (nextLevel(level, sessions) > level) {
    // The database function re-checks the rule itself before changing the level.
    const { error } = await supabase.rpc("apply_level_up");
    if (error) console.error("[analyze] level up failed");
  }
}
