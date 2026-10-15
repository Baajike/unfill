"use client";

import { useSyncExternalStore } from "react";

const STANDALONE_QUERY = "(display-mode: standalone)";

function isIos(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isIosStandalone(): boolean {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia(STANDALONE_QUERY).matches;
  return standalone && isIos();
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

/**
 * iOS 16 home-screen apps can hand the page a live but silent microphone.
 * Recording still works; this just points to the reliable option.
 */
export function StandaloneNotice() {
  const show = useSyncExternalStore(subscribe, isIosStandalone, () => false);
  if (!show) return null;
  return (
    <p className="rounded-card bg-butter p-4 text-sm leading-relaxed text-butter-ink shadow-butter" role="note">
      Recording from the home screen is unreliable on this iPhone. For best results, open{" "}
      <span className="font-bold">unfill.vercel.app</span> in Safari.
    </p>
  );
}
