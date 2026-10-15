import type { Feedback } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="section-label">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function FeedbackCard({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) {
    return (
      <div className="rounded-card border border-border bg-white p-5 text-muted shadow-card">
        Written feedback isn&apos;t available for this session, but your numbers and transcript are saved.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-card border border-border bg-white p-5 shadow-card">
      <p className="text-lg leading-relaxed font-semibold">{feedback.summary}</p>

      <Section title="You did well">
        <p>{feedback.did_well}</p>
      </Section>

      <Section title="Focus next time">
        <p className="rounded-field bg-mint px-4 py-3 font-semibold text-mint-ink">{feedback.focus_next}</p>
      </Section>

      {feedback.vocabulary_upgrades.length > 0 ? (
        <Section title="Word upgrades">
          <ul className="flex flex-col gap-4">
            {feedback.vocabulary_upgrades.map((u, i) => (
              <li key={i}>
                <p className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-3">
                  <span className="break-words text-muted line-through decoration-muted/60">{u.you_said}</span>
                  <span className="text-label" aria-hidden>
                    →
                  </span>
                  <span className="break-words font-bold">
                    <span className="sr-only">try instead </span>
                    {u.try_instead.join(", ")}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted">{u.why}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Fewer fillers">
        <p>{feedback.filler_tip}</p>
      </Section>
    </div>
  );
}
