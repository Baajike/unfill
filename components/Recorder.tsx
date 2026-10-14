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

type Phase = "ready" | "countdown" | "recording" | "uploading" | "error";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

function createRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = pickMimeType();
  try {
    return new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITRATE });
  } catch {
    return new MediaRecorder(stream);
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

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const topic = topics[topicIndex];
  const canSkip = topicIndex === 0 && topics.length > 1;

  function clearTimer() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function releaseDevices() {
    clearTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  // Free the microphone, timer and wake lock if the user navigates away mid-session.
  useEffect(() => {
    const timer = timerRef;
    const stream = streamRef;
    const wakeLock = wakeLockRef;
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      wakeLock.current?.release().catch(() => {});
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
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
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
        clearTimer();
        startRecording();
      }
    }, 1000);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    const recorder = createRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const seconds = (performance.now() - startedAtRef.current) / 1000;
      releaseDevices();
      if (seconds < MIN_RECORDING_SECONDS - 0.5) {
        fail("The recording stopped before 30 seconds. Please try again.");
        return;
      }
      const type = recorder.mimeType || chunksRef.current[0]?.type || "audio/mp4";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (blob.size > MAX_UPLOAD_BYTES) {
        fail("That recording is too large to upload. Please try a shorter session.");
        return;
      }
      blobRef.current = blob;
      void upload(blob);
    };

    // If the microphone goes away (call, lock screen), stop and keep what we have.
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
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
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function upload(blob: Blob) {
    setPhase("uploading");
    setError(null);
    const form = new FormData();
    form.append("audio", blob, "recording");
    form.append("topicId", topic.id);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok && data.id) {
        blobRef.current = null;
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
    blobRef.current = null;
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
        {canRetryUpload ? (
          <Button size="lg" onClick={() => blobRef.current && upload(blobRef.current)}>
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
