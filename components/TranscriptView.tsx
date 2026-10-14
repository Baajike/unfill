import { findFillers } from "@/lib/fillers";

export function TranscriptView({ text }: { text: string }) {
  const parts: Array<{ text: string; filler: boolean }> = [];
  let cursor = 0;
  for (const m of findFillers(text)) {
    if (m.start > cursor) parts.push({ text: text.slice(cursor, m.start), filler: false });
    parts.push({ text: text.slice(m.start, m.end), filler: true });
    cursor = m.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), filler: false });

  if (parts.length === 0) return <p className="text-muted">No speech was transcribed.</p>;

  return (
    <p className="whitespace-pre-wrap text-[1.0625rem] leading-8">
      {parts.map((p, i) =>
        p.filler ? (
          <mark key={i} className="rounded-md bg-accent-soft px-1 py-0.5 text-accent-strong">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
