/** A few new words from the user's bank. Renders nothing when there are none. */
export function WordsToTry({ words, className = "" }: { words: string[]; className?: string }) {
  if (words.length === 0) return null;

  return (
    <section aria-label="Words to try" className={className}>
      <p className="section-label">Words to try today</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {words.map((word) => (
          <li
            key={word}
            className="inline-flex h-[38px] items-center rounded-full bg-sky px-4 text-sm font-bold text-sky-ink"
          >
            {word}
          </li>
        ))}
      </ul>
    </section>
  );
}
