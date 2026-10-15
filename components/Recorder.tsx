"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MIN_RECORDING_SECONDS } from "@/lib/levels";
import { isEssentiallySilent, measureActivity, rmsToDbfs, rootMeanSquare } from "@/lib/metrics";
import type { Topic } from "@/lib/types";
import { Button, ButtonLink, pillLinkClass } from "./Button";
import { LevelMeter } from "./LevelMeter";
import { Timer, formatClock } from "./Timer";

// Vercel rejects request bodies above 4.5 MB. Leave room for the form envelope.
const MAX_UPLOAD_BYTES = 4.4 * 1024 * 1024;
const BITRATE = 32_000;
const COUNTDOWN_FROM = 3;
// How long the mic track may stay muted before we treat it as an interruption.
const MUTE_GRACE_MS = 2000;
const DECODE_TIMEOUT_MS = 15_000;
const WAV_SAMPLE_RATE = 16_000;

// Live meter: anything above this counts as hearing you; flat for this long shows a warning.
const METER_INTERVAL_MS = 100;
const METER_SOUND_DBFS = -60;
const CANT_HEAR_AFTER_MS = 3000;
// The meter bar spans this range.
const METER_FLOOR_DBFS = -60;
const METER_CEILING_DBFS = -10;

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

const RESTART_HINT = "If this keeps happening, close Unfill completely and open it again.";

type Phase =
  | "ready"
  | "countdown"
  | "recording"
  | "checking"
  | "review"
  | "silent"
  | "uploading"
  | "error";

type Recording = {
  blob: Blob;
  /** What gets uploaded: a WAV re-encode when possible, otherwise the original. */
  upload: Blob;
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

function newAudioContext(): AudioContext | null {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  try {
    return Ctx ? new Ctx() : null;
  } catch {
    return null;
  }
}

function dbToLevel(db: number): number {
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DBFS) / (METER_CEILING_DBFS - METER_FLOOR_DBFS)));
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

/** Decodes the finished recording in a separate AudioContext. Never touches the live mic. */
async function decodeRecording(blob: Blob): Promise<AudioBuffer | null> {
  const ctx = newAudioContext();
  if (!ctx) return null;
  try {
    const bytes = await blob.arrayBuffer();
    return await Promise.race([
      new Promise<AudioBuffer>((resolve, reject) => ctx.decodeAudioData(bytes, resolve, reject)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), DECODE_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => {});
  }
}

/**
 * Checks the recording for sound and prepares the upload. Safari writes fragmented
 * MP4, which some server-side decoders only partly read, so it is re-encoded as WAV
 * when that fits. If decoding fails, `silent` is null and the original is uploaded.
 */
async function inspectRecording(blob: Blob): Promise<{ upload: Blob; silent: boolean | null }> {
  const decoded = await decodeRecording(blob);
  if (!decoded) return { upload: blob, silent: null };
  try {
    const mono = toMono16k(decoded);
    const silent = isEssentiallySilent(measureActivity(mono, WAV_SAMPLE_RATE));
    const wavFits = 44 + mono.length * 2 <= MAX_UPLOAD_BYTES;
    return { upload: !isWebm(blob.type) && wavFits ? encodeWav(mono, WAV_SAMPLE_RATE) : blob, silent };
  } catch {
    return { upload: blob, silent: null };
  }
}

function minutesLabel(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

export function Recorder({
  topics,
  targetSeconds,
  notice,
}: {
  topics: Topic[];
  targetSeconds: number;
  notice?: ReactNode;
}) {
  const router = useRouter();
  const [topicIndex, setTopicIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canRetryUpload, setCanRetryUpload] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [level, setLevel] = useState<number | null>(0);
  const [cantHear, setCantHear] = useState(false);

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
  // Live meter state.
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterTimerRef = useRef<number | null>(null);
  const meterRanRef = useRef(false);
  const heardRef = useRef(false);
  const loudestDbRef = useRef(-Infinity);

  const topic = topics[topicIndex];
  const canSkip = topicIndex === 0 && topics.length > 1;

  function clearTimers() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (muteTimerRef.current !== null) window.clearTimeout(muteTimerRef.current);
    timerRef.current = null;
    muteTimerRef.current = null;
  }

  function stopMeter() {
    if (meterTimerRef.current !== null) window.clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
    meterCtxRef.current?.close().catch(() => {});
    meterCtxRef.current = null;
  }

  function releaseDevices() {
    clearTimers();
    stopMeter();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  /** Stops Listen back and fully unloads it so it lets go of the iOS audio session. */
  function unloadPlayer() {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.removeAttribute("src");
    el.load();
  }

  /** Drops the in-memory recording and its playback URL. */
  function discardRecording() {
    unloadPlayer();
    if (recordingRef.current) URL.revokeObjectURL(recordingRef.current.url);
    recordingRef.current = null;
    setRecording(null);
    setShowPlayer(false);
  }

  // Free the microphone, meter, timers, wake lock and audio if the user navigates away.
  useEffect(() => {
    const timer = timerRef;
    const muteTimer = muteTimerRef;
    const meterTimer = meterTimerRef;
    const meterCtx = meterCtxRef;
    const stream = streamRef;
    const wakeLock = wakeLockRef;
    const rec = recordingRef;
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      if (muteTimer.current !== null) window.clearTimeout(muteTimer.current);
      if (meterTimer.current !== null) window.clearInterval(meterTimer.current);
      meterCtx.current?.close().catch(() => {});
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

  /**
   * Routes the mic through an analyser into a silent output. Besides driving the
   * meter, an active input+output graph tells iOS we are recording and playing,
   * which keeps the microphone actually being read.
   */
  function startMeter(ctx: AudioContext | null, stream: MediaStream) {
    meterRanRef.current = false;
    if (!ctx) {
      setLevel(null);
      return;
    }
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const silentOut = ctx.createGain();
      silentOut.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silentOut);
      silentOut.connect(ctx.destination);
      const buffer = new Float32Array(analyser.fftSize);

      meterTimerRef.current = window.setInterval(() => {
        if (ctx.state !== "running") {
          setLevel(null);
          return;
        }
        analyser.getFloatTimeDomainData(buffer);
        const db = rmsToDbfs(rootMeanSquare(buffer));
        setLevel(dbToLevel(db));

        if (startedAtRef.current === 0) return; // still counting down
        meterRanRef.current = true;
        if (db > loudestDbRef.current) loudestDbRef.current = db;
        if (db > METER_SOUND_DBFS) {
          heardRef.current = true;
          setCantHear(false);
        } else if (!heardRef.current && performance.now() - startedAtRef.current >= CANT_HEAR_AFTER_MS) {
          setCantHear(true);
        }
      }, METER_INTERVAL_MS);
    } catch {
      setLevel(null);
    }
  }

  async function begin() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      fail("This browser can't record audio. Try Safari on iPhone or Chrome on desktop.");
      return;
    }
    unloadPlayer();
    // Create and resume the AudioContext inside the tap, before any await,
    // so iOS treats it as started by the user.
    const ctx = newAudioContext();
    ctx?.resume().catch(() => {});
    meterCtxRef.current = ctx;

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

    startedAtRef.current = 0;
    heardRef.current = false;
    loudestDbRef.current = -Infinity;
    setCantHear(false);
    setLevel(ctx ? 0 : null);
    startMeter(ctx, streamRef.current);

    setCountdown(COUNTDOWN_FROM);
    setPhase("countdown");
    let n = COUNTDOWN_FROM;
    timerRef.current = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
      } else {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        startRecording();
      }
    }, 1000);
  }

  async function finishRecording(blob: Blob, seconds: number) {
    setPhase("checking");
    const meterRan = meterRanRef.current;
    const loudest = loudestDbRef.current;
    const { upload, silent } = await inspectRecording(blob);
    // If the file couldn't be decoded, fall back to what the live meter heard.
    const isSilent = silent ?? (meterRan && loudest <= METER_SOUND_DBFS);

    const rec: Recording = {
      blob,
      upload,
      url: URL.createObjectURL(blob),
      seconds,
      interrupted: interruptedRef.current,
    };
    recordingRef.current = rec;
    setRecording(rec);
    setShowPlayer(false);
    setPhase(isSilent ? "silent" : "review");
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
      void finishRecording(blob, seconds);
    };

    // iOS can silence (mute) or end the mic track mid-recording, e.g. on an audio
    // session interruption. Stop and keep what we have rather than record silence.
    const interrupt = () => {
      interruptedRef.current = true;
      stop();
    };
    const tracks = stream.getAudioTracks();
    tracks.forEach((track) => {
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
    // A track that is already muted or dead won't deliver audio: warn straight away.
    if (tracks.length === 0 || tracks.some((t) => t.readyState !== "live" || t.muted)) {
      setCantHear(true);
    }

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

    const form = new FormData();
    form.append("audio", rec.upload, "recording");
    form.append("topicId", topic.id);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        code?: string;
      };
      if (res.ok && data.id) {
        discardRecording();
        router.replace(`/results/${data.id}`);
        return;
      }
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (data.code === "no_speech") {
        setShowPlayer(false);
        setPhase("silent");
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
    setCantHear(false);
    setPhase("ready");
  }

  const player = recording ? (
    <>
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
    </>
  ) : null;

  if (phase === "ready") {
    return (
      <div className="flex flex-1 flex-col animate-rise">
        <Link href="/" className={`${pillLinkClass} self-start`}>
          Back
        </Link>
        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="rounded-card border border-border bg-white p-6 shadow-card">
            <p className="inline-flex h-7 items-center rounded-full bg-mint px-3 text-[0.6875rem] font-extrabold tracking-[0.9px] text-mint-ink uppercase">
              {TIER_LABEL[topic.tier]}
            </p>
            <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight">{topic.text}</h1>
            <p className="mt-3 text-muted">Speak for {minutesLabel(targetSeconds)}. Take your time.</p>
          </div>
        </div>
        {notice ? <div className="mb-4">{notice}</div> : null}
        <div className="flex flex-col gap-3">
          <Button size="xl" onClick={begin}>
            Start
          </Button>
          {canSkip ? (
            <Button variant="ghost" size="md" onClick={() => setTopicIndex(1)}>
              Skip topic
            </Button>
          ) : (
            <p className="min-h-11 text-center text-sm leading-[2.75rem] text-muted">Topic skipped</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="max-w-xs text-xl font-semibold text-muted">{topic.text}</p>
        <div className="mt-10 flex h-44 w-44 items-center justify-center rounded-full bg-mint shadow-mint">
          <p
            key={countdown}
            className="text-8xl font-extrabold text-mint-ink tabular-nums animate-rise"
            aria-live="assertive"
          >
            {countdown}
          </p>
        </div>
        <div className="mt-10 w-40">
          <LevelMeter level={level} />
        </div>
      </div>
    );
  }

  if (phase === "recording") {
    const remaining = Math.max(0, targetSeconds - elapsed);
    const canStop = elapsed >= MIN_RECORDING_SECONDS;
    return (
      <div className="flex flex-1 flex-col">
        <div className="inline-flex h-8 items-center gap-2 self-start rounded-full bg-peach px-3 text-sm font-bold text-peach-ink">
          <span className="h-2.5 w-2.5 rounded-full bg-peach-ink animate-breathe" aria-hidden />
          Recording
        </div>
        <p className="mt-4 text-2xl leading-snug font-bold">{topic.text}</p>
        <div className="flex flex-1 flex-col justify-center gap-8">
          <Timer remaining={remaining} total={targetSeconds} />
          <div className="flex flex-col gap-3">
            <LevelMeter level={level} />
            <p className="min-h-12 text-center text-sm leading-relaxed font-semibold text-peach-ink" role="alert">
              {cantHear ? `We can't hear you. Check your microphone. ${RESTART_HINT}` : ""}
            </p>
          </div>
        </div>
        <Button size="xl" variant="secondary" onClick={stop} disabled={!canStop}>
          Stop
        </Button>
        <p className="mt-3 min-h-6 text-center text-sm text-muted">
          {canStop ? "" : `You can stop after ${formatClock(MIN_RECORDING_SECONDS)}`}
        </p>
      </div>
    );
  }

  if (phase === "checking") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        <span className="h-14 w-14 rounded-full bg-mint shadow-mint animate-breathe" aria-hidden />
        <p className="mt-6 text-lg font-semibold text-muted">Checking your recording</p>
      </div>
    );
  }

  if (phase === "silent" && recording) {
    return (
      <div className="flex flex-1 flex-col animate-rise">
        <p className="section-label">{formatClock(recording.seconds)} recorded</p>
        <div className="flex flex-1 flex-col justify-center gap-4 py-8" role="alert">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">No speech was recorded</h1>
          <p className="leading-relaxed text-muted">
            The microphone didn&apos;t pick up your voice, so this wasn&apos;t analysed and doesn&apos;t
            count toward today&apos;s limit. Check your microphone and try again. {RESTART_HINT}
          </p>
          {player}
        </div>
        <div className="flex flex-col gap-3">
          <Button size="xl" onClick={startOver}>
            Record again
          </Button>
          <ButtonLink href="/" variant="ghost" size="md">
            Home
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (phase === "review" && recording) {
    const longEnough = recording.seconds >= MIN_RECORDING_SECONDS - 0.5;
    const fits = recording.upload.size <= MAX_UPLOAD_BYTES;
    const canAnalyse = longEnough && fits;
    return (
      <div className="flex flex-1 flex-col animate-rise">
        <p className="section-label">{formatClock(recording.seconds)} recorded</p>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight">{topic.text}</h1>

        <div className="flex flex-1 flex-col justify-center gap-4 py-8">
          {recording.interrupted ? (
            <p className="rounded-card bg-peach p-4 leading-relaxed text-peach-ink shadow-peach" role="alert">
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
          {player}
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
        <span className="h-16 w-16 rounded-full bg-lavender shadow-lavender animate-breathe" aria-hidden />
        <p className="mt-8 text-xl font-bold">Listening back to you</p>
        <p className="mt-2 text-muted">This usually takes a few seconds.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 animate-rise" role="alert">
      <p className="rounded-card border border-border bg-white p-5 text-lg leading-relaxed font-semibold shadow-card">
        {error}
      </p>
      <div className="flex flex-col gap-3">
        {canRetryUpload && recording ? (
          <Button size="lg" onClick={analyse}>
            Try uploading again
          </Button>
        ) : null}
        <Button size="lg" variant={canRetryUpload ? "secondary" : "primary"} onClick={startOver}>
          Record again
        </Button>
        <ButtonLink href="/" variant="ghost" size="md">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
