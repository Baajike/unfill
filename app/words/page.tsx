import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
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

const GROUPS: Array<{ status: WordBankStatus; title: string; empty: string }> = [
  { status: "new", title: "New", empty: "New suggestions from your sessions appear here." },
  { status: "used", title: "Used", empty: "Say a word from your bank in a session and it moves here." },
  { status: "dismissed", title: "Dismissed", empty: "Nothing dismissed." },
];

function DismissButton({ id }: { id: string }) {
  return (
    <form action={dismissWord}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="min-h-11 px-3 text-sm text-muted hover:text-ink">
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
    <div className="flex flex-col animate-rise">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Words</h1>
        <ButtonLink href="/" variant="ghost" size="md" className="-mr-5">
          Home
        </ButtonLink>
      </header>
      <p className="mt-2 text-muted">Suggestions from your feedback. Try to use them when you speak.</p>

      {GROUPS.map((group) => {
        const items = words.filter((w) => w.status === group.status);
        return (
          <section key={group.status} className="mt-8">
            <h2 className="text-sm font-medium text-muted">
              {group.title} <span className="tabular-nums text-faint">{items.length}</span>
            </h2>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-faint">{group.empty}</p>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {items.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-4 py-2">
                    <div className="min-w-0">
                      <p className={`font-medium ${w.status === "dismissed" ? "text-muted" : ""}`}>{w.phrase}</p>
                      <p className="truncate text-sm text-faint">
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
