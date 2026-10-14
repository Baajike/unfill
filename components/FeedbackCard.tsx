import type { Feedback } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

export function FeedbackCard({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) {
    return (
      <div className="rounded-card bg-surface p-5 text-muted">
        Written feedback isn&apos;t available for this session, but your numbers and transcript are saved.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-card bg-surface p-5">
      <p className="text-lg leading-relaxed">{feedback.summary}</p>

      <Section title="You did well">
        <p>{feedback.did_well}</p>
      </Section>

      <Section title="Focus next time">
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-accent-strong">{feedback.focus_next}</p>
      </Section>

      {feedback.vocabulary_upgrades.length > 0 ? (
        <Section title="Word upgrades">
          <ul className="flex flex-col gap-4">
            {feedback.vocabulary_upgrades.map((u, i) => (
              <li key={i}>
                <p>
                  <span className="text-muted line-through decoration-faint">{u.you_said}</span>
                  <span className="mx-2 text-faint" aria-hidden>
                    →
                  </span>
                  <span className="sr-only">try instead</span>
                  <span className="font-medium">{u.try_instead.join(", ")}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted">{u.why}</p>
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
