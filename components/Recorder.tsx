"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MIN_RECORDING_SECONDS } from "@/lib/levels";
import type { Topic } from "@/lib/types";
import { Button, ButtonLink } from "./Button";
import { Timer, formatClock } from "./Timer";

// Vercel rejects request bodies above 4.5 MB. Leave room for the form envelope.
const MAX_UPLOAD_BYTES = 4.4 * 1024 * 1024;
const BITRATE = 32_000;
const COUNTDOWN_FROM = 3;
// How long the mic track may stay muted before we treat it as an interruption.
const MUTE_GRACE_MS = 2000;
const DECODE_TIMEOUT_MS = 15_000;
const WAV_SAMPLE_RATE = 16_000;

// Chrome records WebM/Opus; iOS Safari records MP4/AAC.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
];

const TIER_LABEL: Record<Topic["tier"], string> = {
  concrete: "Describe",
  process: "Explain",
  opinion: "Your view",
};

type Phase = "ready" | "countdown" | "recording" | "review" | "uploading" | "error";

type Recording = {
  blob: Blob;
  url: string;
  seconds: number;
  interrupted: boolean;
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

function isWebm(mimeType: string | undefined): boolean {
  return Boolean(mimeType?.startsWith("audio/webm"));
}

function createRecorder(stream: MediaStream, mimeType: string | undefined): MediaRecorder {
  try {
    // Safari's AAC encoder doesn't reliably honour a custom bitrate, so only set it for WebM.
    return new MediaRecorder(
      stream,
      isWebm(mimeType) ? { mimeType, audioBitsPerSecond: BITRATE } : { mimeType },
    );
  } catch {
    return new MediaRecorder(stream);
  }
}

/** 16-bit PCM mono WAV. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Mixes to mono and downsamples by averaging each window (a simple anti-alias filter). */
function toMono16k(audio: AudioBuffer): Float32Array {
  const ratio = audio.sampleRate / WAV_SAMPLE_RATE;
  const length = Math.floor(audio.length / ratio);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (const data of channels) {
      for (let j = start; j < end && j < data.length; j++) sum += data[j];
    }
    out[i] = sum / ((end - start) * channels.length);
  }
  return out;
}

/**
 * Safari writes fragmented MP4, which some server-side decoders only partly read.
 * Re-encode it as plain WAV in memory when that fits the upload limit. Any failure
 * (decode error, timeout, too large) falls back to the original file.
 */
async function prepareForUpload(blob: Blob): Promise<Blob> {
  if (isWebm(blob.type)) return blob;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return blob;

  let ctx: AudioContext | null = null;
  try {
    ctx = new Ctx();
    const context = ctx;
    const bytes = await blob.arrayBuffer();
    const decoded = await Promise.race([
      new Promise<AudioBuffer>((resolve, reject) => context.decodeAudioData(bytes, resolve, reject)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), DECODE_TIMEOUT_MS)),
    ]);
    if (44 + Math.ceil(decoded.duration * WAV_SAMPLE_RATE) * 2 > MAX_UPLOAD_BYTES) return blob;
    return encodeWav(toMono16k(decoded), WAV_SAMPLE_RATE);
  } catch {
    return blob;
  } finally {
    ctx?.close().catch(() => {});
  }
}

function minutesLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

export function Recorder({ topics, targetSeconds }: { topics: Topic[]; targetSeconds: number }) {
  const router = useRouter();
  const [topicIndex, setTopicIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canRetryUpload, setCanRetryUpload] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mimeTypeRef = useRef<string | undefined>(undefined);
  const chunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef<Recording | null>(null);
  const timerRef = useRef<number | null>(null);
  const muteTimerRef = useRef<number | null>(null);
  const interruptedRef = useRef(false);
  const startedAtRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const topic = topics[topicIndex];
  const canSkip = topicIndex === 0 && topics.length > 1;

  function clearTimers() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (muteTimerRef.current !== null) window.clearTimeout(muteTimerRef.current);
    timerRef.current = null;
    muteTimerRef.current = null;
  }

  function releaseDevices() {
    clearTimers();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  /** Drops the in-memory recording and its playback URL. */
  function discardRecording() {
    if (recordingRef.current) URL.revokeObjectURL(recordingRef.current.url);
    recordingRef.current = null;
    setRecording(null);
    setShowPlayer(false);
  }

  // Free the microphone, timers, wake lock and audio if the user navigates away mid-session.
  useEffect(() => {
    const timer = timerRef;
    const muteTimer = muteTimerRef;
    const stream = streamRef;
    const wakeLock = wakeLockRef;
    const rec = recordingRef;
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      if (muteTimer.current !== null) window.clearTimeout(muteTimer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      wakeLock.current?.release().catch(() => {});
      if (rec.current) URL.revokeObjectURL(rec.current.url);
    };
  }, []);

  function fail(message: string, retryUpload = false) {
    releaseDevices();
    setError(message);
    setCanRetryUpload(retryUpload);
    setPhase("error");
  }

  async function begin() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      fail("This browser can't record audio. Try Safari on iPhone or Chrome on desktop.");
      return;
    }
    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;
    try {
      // Plain constraints on Safari: extra ones have been known to leave iOS tracks silent.
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: isWebm(mimeType)
          ? { channelCount: 1, echoCancellation: true, noiseSuppression: true }
          : true,
      });
    } catch {
      fail("Unfill needs your microphone. Allow access in your browser settings and try again.");
      return;
    }

    setCountdown(COUNTDOWN_FROM);
    setPhase("countdown");
    let n = COUNTDOWN_FROM;
    timerRef.current = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
      } else {
        clearTimers();
        startRecording();
      }
    }, 1000);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    // No timeslice: the browser delivers the whole recording in one final dataavailable event.
    const recorder = createRecorder(stream, mimeTypeRef.current);
    recorderRef.current = recorder;
    chunksRef.current = [];
    interruptedRef.current = false;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const seconds = (performance.now() - startedAtRef.current) / 1000;
      releaseDevices();
      const type = recorder.mimeType || chunksRef.current[0]?.type || "audio/mp4";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      // Always keep what was captured so it can be checked and, if long enough, analysed.
      const rec: Recording = {
        blob,
        url: URL.createObjectURL(blob),
        seconds,
        interrupted: interruptedRef.current,
      };
      recordingRef.current = rec;
      setRecording(rec);
      setShowPlayer(false);
      setPhase("review");
    };

    // iOS can silence (mute) or end the mic track mid-recording, e.g. on an audio
    // session interruption. Stop and keep what we have rather than record silence.
    const interrupt = () => {
      interruptedRef.current = true;
      stop();
    };
    stream.getAudioTracks().forEach((track) => {
      track.onended = interrupt;
      track.onmute = () => {
        if (muteTimerRef.current === null) {
          muteTimerRef.current = window.setTimeout(interrupt, MUTE_GRACE_MS);
        }
      };
      track.onunmute = () => {
        if (muteTimerRef.current !== null) window.clearTimeout(muteTimerRef.current);
        muteTimerRef.current = null;
      };
    });

    recorder.start();
    startedAtRef.current = performance.now();
    setElapsed(0);
    setPhase("recording");

    if ("wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then((lock) => (wakeLockRef.current = lock))
        .catch(() => {});
    }

    timerRef.current = window.setInterval(() => {
      const seconds = (performance.now() - startedAtRef.current) / 1000;
      setElapsed(seconds);
      if (seconds >= targetSeconds) stop();
    }, 250);
  }

  function stop() {
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function listenBack() {
    setShowPlayer(true);
    audioRef.current?.play().catch(() => {});
  }

  async function analyse() {
    const rec = recordingRef.current;
    if (!rec) return;
    audioRef.current?.pause();
    setPhase("uploading");
    setError(null);

    const audio = await prepareForUpload(rec.blob);
    const form = new FormData();
    form.append("audio", audio, "recording");
    form.append("topicId", topic.id);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok && data.id) {
        discardRecording();
        router.replace(`/results/${data.id}`);
        return;
      }
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const retryable = res.status >= 500 || res.status === 408;
      fail(data.error ?? "Something went wrong. Please try again.", retryable);
    } catch {
      fail("Couldn't reach the server. Check your connection and try again.", true);
    }
  }

  function startOver() {
    discardRecording();
    setError(null);
    setElapsed(0);
    setPhase("ready");
  }

  if (phase === "ready") {
    return (
      <div className="flex flex-1 flex-col animate-rise">
        <ButtonLink href="/" variant="ghost" size="md" className="-ml-5 self-start">
          Back
        </ButtonLink>
        <div className="flex flex-1 flex-col justify-center py-10">
          <p className="text-sm font-medium tracking-wide text-accent-strong uppercase">
            {TIER_LABEL[topic.tier]}
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-tight">{topic.text}</h1>
          <p className="mt-4 text-muted">Speak for {minutesLabel(targetSeconds)}. Take your time.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button size="xl" onClick={begin}>
            Start
          </Button>
          {canSkip ? (
            <Button variant="ghost" size="md" onClick={() => setTopicIndex(1)}>
              Skip topic
            </Button>
          ) : (
            <p className="min-h-11 text-center text-sm leading-[2.75rem] text-faint">Topic skipped</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="max-w-xs text-xl text-muted">{topic.text}</p>
        <p key={countdown} className="mt-10 text-9xl font-light tabular-nums animate-rise" aria-live="assertive">
          {countdown}
        </p>
      </div>
    );
  }

  if (phase === "recording") {
    const remaining = Math.max(0, targetSeconds - elapsed);
    const canStop = elapsed >= MIN_RECORDING_SECONDS;
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-accent animate-breathe" aria-hidden />
          Recording
        </div>
        <p className="mt-4 text-2xl leading-snug font-medium">{topic.text}</p>
        <div className="flex flex-1 items-center">
          <Timer remaining={remaining} total={targetSeconds} />
        </div>
        <Button size="xl" variant="secondary" onClick={stop} disabled={!canStop}>
          Stop
        </Button>
        <p className="mt-3 min-h-6 text-center text-sm text-faint">
          {canStop ? "" : `You can stop after ${formatClock(MIN_RECORDING_SECONDS)}`}
        </p>
      </div>
    );
  }

  if (phase === "review" && recording) {
    const longEnough = recording.seconds >= MIN_RECORDING_SECONDS - 0.5;
    const fits = recording.blob.size <= MAX_UPLOAD_BYTES;
    const canAnalyse = longEnough && fits;
    return (
      <div className="flex flex-1 flex-col animate-rise">
        <p className="text-sm text-muted">{formatClock(recording.seconds)} recorded</p>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight">{topic.text}</h1>

        <div className="flex flex-1 flex-col justify-center gap-4 py-8">
          {recording.interrupted ? (
            <p className="rounded-card bg-surface p-4 leading-relaxed" role="alert">
              Your microphone was interrupted, so the recording stopped early. Listen back to check
              what was captured{canAnalyse ? ", then analyse it if it sounds right." : "."}
            </p>
          ) : null}
          {!longEnough ? (
            <p className="text-muted">
              This recording is under {formatClock(MIN_RECORDING_SECONDS)}, which is too short to
              analyse.
            </p>
          ) : null}
          {!fits ? (
            <p className="text-muted">This recording is too large to upload. Please try a shorter session.</p>
          ) : null}

          {/* Plays from browser memory only; nothing is uploaded until you tap Analyse. */}
          <audio
            ref={audioRef}
            src={recording.url}
            controls
            preload="metadata"
            className={showPlayer ? "w-full" : "hidden"}
          />
          {!showPlayer ? (
            <Button variant="secondary" size="lg" onClick={listenBack}>
              Listen back
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          {canAnalyse ? (
            <Button size="xl" onClick={analyse}>
              Analyse
            </Button>
          ) : null}
          <Button size="lg" variant={canAnalyse ? "ghost" : "primary"} onClick={startOver}>
            Record again
          </Button>
          <ButtonLink href="/" variant="ghost" size="md">
            Home
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (phase === "uploading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        <span className="h-16 w-16 rounded-full bg-accent-soft animate-breathe" aria-hidden />
        <p className="mt-8 text-xl">Listening back to you</p>
        <p className="mt-2 text-muted">This usually takes a few seconds.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 animate-rise" role="alert">
      <p className="text-xl leading-relaxed">{error}</p>
      <div className="flex flex-col gap-3">
        {canRetryUpload && recording ? (
          <Button size="lg" onClick={analyse}>
            Try uploading again
          </Button>
        ) : null}
        <Button size="lg" variant={canRetryUpload ? "secondary" : "primary"} onClick={startOver}>
          Start over
        </Button>
        <ButtonLink href="/" variant="ghost" size="md">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
