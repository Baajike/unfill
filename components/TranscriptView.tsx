import type { ReactNode } from "react";
import { findFillers } from "@/lib/fillers";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word, case-insensitive matcher for bank phrases, following the same boundaries as
 * findUsedPhrases (no letter or digit on either side, an optional possessive 's).
 * Display only: it decides what to highlight, not what counts as used.
 */
function bankPattern(phrases: string[]): RegExp | null {
  const bodies = phrases
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .sort((a, b) => b.length - a.length)
    .map((p) =>
      escapeRegExp(p)
        .replace(/'/g, "['‘’ʼ`]")
        .replace(/-/g, "[-‐‑]")
        .replace(/\s+/g, "\\s+"),
    );
  if (bodies.length === 0) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}]['‘’ʼ\`-]?)(?:${bodies.join("|")})(?:['‘’ʼ\`]s)?(?!['‘’ʼ\`-]?[\\p{L}\\p{N}])`,
    "giu",
  );
}

function withBankWords(text: string, pattern: RegExp | null, keyPrefix: string): ReactNode[] {
  if (!pattern) return [text];
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <strong key={`${keyPrefix}-${start}`} className="rounded-md bg-sky px-1 py-0.5 font-bold text-sky-ink">
        {m[0]}
      </strong>,
    );
    cursor = start + m[0].length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function TranscriptView({ text, bankWords = [] }: { text: string; bankWords?: string[] }) {
  const parts: Array<{ text: string; filler: boolean }> = [];
  let cursor = 0;
  for (const m of findFillers(text)) {
    if (m.start > cursor) parts.push({ text: text.slice(cursor, m.start), filler: false });
    parts.push({ text: text.slice(m.start, m.end), filler: true });
    cursor = m.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), filler: false });

  if (parts.length === 0) {
    return (
      <p className="rounded-card border border-border bg-white p-5 text-muted shadow-card">
        No speech was transcribed.
      </p>
    );
  }

  const pattern = bankPattern(bankWords);

  return (
    <p className="whitespace-pre-wrap rounded-card border border-border bg-white p-5 leading-8 shadow-card">
      {parts.map((p, i) =>
        p.filler ? (
          <mark key={i} className="rounded-md bg-filler px-1 py-0.5 font-semibold text-peach-ink">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{withBankWords(p.text, pattern, String(i))}</span>
        ),
      )}
    </p>
  );
}
