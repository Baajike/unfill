import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { buttonClass, pillLinkClass } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { TINT, type Tint } from "@/components/categoryTint";
import { HeroGlow } from "./HeroGlow";
import { PhoneMock } from "./PhoneMock";

const GITHUB_URL = "https://github.com/Baajike/unfill";

/** Staggered entrance; the global reduced-motion rule turns it off. */
const rise = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function GitHubLink({ className, children }: { className: string; children: ReactNode }) {
  return (
    <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const STEPS: Array<{ tint: Tint; title: string; body: string }> = [
  { tint: "mint", title: "Pick a topic", body: "Choose a category or take a random everyday topic." },
  { tint: "peach", title: "Speak against the clock", body: "Talk without stopping until the timer runs out." },
  { tint: "lavender", title: "Get feedback", body: "See your transcript, your fillers and a few kind, honest notes." },
];

const TRACKS: Array<{ tint: Tint; title: string; body: string }> = [
  { tint: "mint", title: "Filler words per minute", body: "Um, uh, like and you know, counted for you." },
  { tint: "lavender", title: "Pace in words per minute", body: "Know whether you rush or linger." },
  { tint: "sky", title: "Vocabulary variety", body: "How many different words you reach for." },
  { tint: "butter", title: "Your word bank", body: "Better word choices from your sessions, saved to try next time." },
];

const CARE = [
  "Audio is never stored, only the transcript.",
  "API keys stay on the server.",
  "Runs entirely on free tiers: Groq Whisper, Gemini, Supabase and Vercel.",
  "Open source under the MIT licence.",
];

/** Public landing page for signed-out visitors at "/". Static: no user data. */
export function Landing() {
  return (
    // Breaks out of the layout's narrow <main> to the full viewport width.
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col px-6">
        <header className="flex items-center justify-between gap-3 animate-rise">
          <Link href="/" className="flex items-center gap-2.5 rounded-full">
            <Logo size="sm" />
            <span className="text-lg font-extrabold tracking-tight">Unfill</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2">
            <GitHubLink className={pillLinkClass}>GitHub</GitHubLink>
            <Link href="/login" className={buttonClass("primary", "md")}>
              Sign in
            </Link>
          </nav>
        </header>

        <section className="relative isolate mt-12 grid items-center gap-12 md:mt-20 md:grid-cols-[1.1fr_1fr]">
          <HeroGlow />
          <div className="animate-rise" style={rise(60)}>
            <h1 className="text-[2.5rem] leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Say what you mean. Skip the um.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Unfill gives you a random topic, a timer and honest feedback. Speak for a minute a day and watch
              your filler words fall.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={buttonClass("primary", "lg")}>
                Sign in
              </Link>
              <GitHubLink className={buttonClass("secondary", "lg")}>View on GitHub</GitHubLink>
            </div>
          </div>
          <div className="animate-rise" style={rise(140)}>
            <PhoneMock />
          </div>
        </section>

        <section aria-labelledby="how" className="mt-24 animate-rise" style={rise(200)}>
          <h2 id="how" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const t = TINT[s.tint];
              return (
                <li key={s.title} className={`rounded-card p-6 ${t.gradient} ${t.shadow}`}>
                  <span
                    aria-hidden
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-extrabold shadow-soft ${t.text}`}
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 text-muted">{s.body}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="tracks" className="mt-20 animate-rise" style={rise(240)}>
          <h2 id="tracks" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            What it tracks
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRACKS.map((m) => {
              const t = TINT[m.tint];
              return (
                <li key={m.title} className={`rounded-card p-5 ${t.gradient} ${t.shadow}`}>
                  <h3 className={`text-[0.6875rem] font-extrabold tracking-[0.9px] uppercase ${t.text}`}>{m.title}</h3>
                  <p className="mt-2 text-[0.9375rem] font-semibold">{m.body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="care"
          className="mt-20 rounded-card border border-white bg-white/86 p-6 shadow-card backdrop-blur-md animate-rise sm:p-8"
          style={rise(280)}
        >
          <h2 id="care" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Built with care
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {CARE.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="text-muted">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="start"
          className="mt-20 flex flex-col items-start gap-6 rounded-card bg-gradient-to-br from-mint to-lavender p-8 shadow-lavender animate-rise sm:flex-row sm:items-center sm:justify-between sm:p-10"
          style={rise(320)}
        >
          <h2 id="start" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            One minute a day is enough to start.
          </h2>
          <Link href="/login" className={buttonClass("primary", "lg", "shrink-0")}>
            Sign in
          </Link>
        </section>

        <footer className="mt-16 flex flex-col items-center gap-2 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:justify-between">
          <p>Made by Immanuella Baajike</p>
          <GitHubLink className="rounded-full font-semibold text-ink underline-offset-4 hover:underline">
            GitHub
          </GitHubLink>
          <p>© 2026</p>
        </footer>
      </div>
    </div>
  );
}
