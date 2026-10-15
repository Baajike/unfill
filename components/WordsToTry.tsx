/** A few new words from the user's bank. Renders nothing when there are none. */
export function WordsToTry({ words, className = "" }: { words: string[]; className?: string }) {
  if (words.length === 0) return null;

  return (
    <section aria-label="Words to try" className={`rounded-card bg-surface p-4 ${className}`}>
      <p className="text-sm text-muted">Words to try</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {words.map((word) => (
          <li key={word} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-strong">
            {word}
          </li>
        ))}
      </ul>
    </section>
  );
}
