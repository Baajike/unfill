import Link from "next/link";
import { redirect } from "next/navigation";
import { pillLinkClass } from "@/components/Button";
import { TINT, type Tint } from "@/components/categoryTint";
import { getUser } from "@/lib/supabase/server";
import type { WordBankStatus } from "@/lib/types";
import { dismissWord } from "./actions";

// At 5 new words a session and 15 sessions a day, this covers months of practice.
const WORDS_LIMIT = 1000;

type Word = {
  id: string;
  phrase: string;
  replaces: string | null;
  status: WordBankStatus;
  times_used: number;
};

const GROUPS: Array<{ status: WordBankStatus; title: string; empty: string; tint: Tint }> = [
  { status: "new", title: "New", empty: "New suggestions from your sessions appear here.", tint: "sky" },
  {
    status: "used",
    title: "Used",
    empty: "Say a word from your bank in a session and it moves here.",
    tint: "mint",
  },
  { status: "dismissed", title: "Dismissed", empty: "Nothing dismissed.", tint: "butter" },
];

function DismissButton({ id }: { id: string }) {
  return (
    <form action={dismissWord}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="min-h-11 rounded-full border border-border bg-white px-4 text-sm font-bold text-muted shadow-soft transition duration-150 hover:text-ink active:translate-y-px active:shadow-none"
      >
        Dismiss
      </button>
    </form>
  );
}

export default async function WordsPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("word_bank")
    .select("id, phrase, replaces, status, times_used")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(WORDS_LIMIT);
  const words: Word[] = data ?? [];

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <header>
        <div className="flex items-center justify-between">
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">Words</h1>
          <Link href="/" className={pillLinkClass}>
            Home
          </Link>
        </div>
        <p className="mt-2 text-muted">Suggestions from your feedback. Try to use them when you speak.</p>
      </header>

      {GROUPS.map((group) => {
        const items = words.filter((w) => w.status === group.status);
        const t = TINT[group.tint];
        return (
          <section key={group.status}>
            <h2 className="section-label flex items-center gap-2">
              {group.title}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 tracking-normal tabular-nums ${t.bg} ${t.text}`}
              >
                {items.length}
              </span>
            </h2>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{group.empty}</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border rounded-card border border-border bg-white px-4 shadow-card">
                {items.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className={`font-bold ${w.status === "dismissed" ? "text-muted" : ""}`}>{w.phrase}</p>
                      <p className="truncate text-sm text-muted">
                        {w.status === "used" ? `Used ${w.times_used}×` : null}
                        {w.status === "used" && w.replaces ? " · " : null}
                        {w.replaces ? `instead of “${w.replaces}”` : null}
                      </p>
                    </div>
                    {w.status === "dismissed" ? null : <DismissButton id={w.id} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
