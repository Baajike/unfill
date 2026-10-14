# Unfill

A minimal speaking-practice app. Pick up your phone, get a random everyday topic, and talk
for a set time. Unfill transcribes what you said, counts your filler words (um, uh, like,
you know…), and gives you short, warm feedback. Sessions get longer as you get better.

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase Auth (email + password) and Postgres with Row Level Security
- Groq Whisper (`whisper-large-v3`) for transcription
- Google Gemini for feedback, with a Groq chat model as automatic fallback
- Installable PWA (iPhone home screen, desktop Chrome)

Everything runs on free tiers.

## 1. Prerequisites (Windows, Git Bash)

- [Node.js](https://nodejs.org) 22 or newer (24 LTS recommended). Check with `node -v`.
- [Git for Windows](https://git-scm.com/download/win), which includes Git Bash.
- Free accounts: [Supabase](https://supabase.com), [Groq](https://console.groq.com),
  [Google AI Studio](https://aistudio.google.com), [Vercel](https://vercel.com).

```bash
git clone <your-repo-url> unfill
cd unfill
npm install
cp .env.example .env.local
```

## 2. Supabase

1. Create a new project.
2. **SQL Editor** → New query → paste all of `supabase/migrations/0001_init.sql` → Run.
3. **Authentication → Sign In / Providers → Email**: keep Email enabled and turn **off**
   "Confirm email". (The app has no email-confirmation callback page.)
4. **Project Settings → API** (or **API Keys**): copy the Project URL and the `anon` /
   publishable key into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Never put the `service_role` / secret key anywhere in this app. It is not needed.

## 3. API keys

| Variable          | Where to get it                                     |
| ----------------- | --------------------------------------------------- |
| `GROQ_API_KEY`    | https://console.groq.com/keys                       |
| `GEMINI_API_KEY`  | https://aistudio.google.com/apikey                  |
| `GEMINI_MODEL`    | Optional. Default `gemini-2.5-flash`                |
| `GROQ_CHAT_MODEL` | Optional. Default `llama-3.3-70b-versatile`         |

These are server-only. Never prefix them with `NEXT_PUBLIC_`.

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000, create an account and do a session. Browsers allow the
microphone on `localhost`. To test on a phone you need HTTPS, so use a Vercel preview
deployment (below).

Checks:

```bash
npm test        # unit tests (metrics, fillers, levels, streak)
npm run lint
npm run build
```

## 5. Deploy to Vercel

1. Push the repo to GitHub, then in Vercel: **Add New → Project → Import** the repo.
   Framework preset: Next.js. No build settings need changing.
2. **Settings → Environment Variables**: add all six variables from `.env.example`
   (Production and Preview).
3. Deploy.
4. Back in Supabase, **Authentication → URL Configuration**: set **Site URL** to your
   Vercel URL (e.g. `https://unfill.vercel.app`).

## 6. Add to your iPhone home screen

1. Open your Vercel URL in **Safari** on iOS 16.4 or newer. iPhone X can update to
   16.7; Tailwind CSS v4 needs 16.4+.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open Unfill from the home screen and sign in. Allow the microphone when asked.
   iOS may ask again after the app has been closed for a while.

Tip: the app asks the screen to stay awake while recording, but older iOS versions ignore
this. If your screen locks mid-session, set **Settings → Display & Brightness → Auto-Lock**
to a few minutes.

## How it works

1. **Session**: a random topic (never one of your last 10), one skip allowed, a 3-2-1
   countdown, then recording with `MediaRecorder` (WebM/Opus in Chrome, MP4/AAC in Safari)
   at about 32 kbps mono. You can stop after 30 seconds.
2. **`POST /api/analyze`**: checks your login, the upload type, size and daily limit (15
   per rolling 24 hours). It sends the audio to Groq Whisper in memory, computes the
   metrics in code (`lib/metrics.ts`), asks the LLM for feedback, saves the session, and
   returns its id. Audio is never stored.
3. **Results**: today against your previous session and your 7-day average, the
   transcript with fillers highlighted, and the feedback.

**Levels:** 1, 2, 3, 5, 7, 10, 15, 20, 30, 45 and 60 minutes. You go up a level after 3
completed sessions in a row at your current level with ≤ 4 fillers per minute. A session
counts as completed at 80% of the target time.

**Streak:** consecutive days, in your own timezone, with at least one completed session.

## Known limits / TODO

- **Sessions are capped at 5 minutes for now.** Vercel functions reject request bodies
  over 4.5 MB, so longer recordings can't be uploaded in one request. The level ladder
  goes up to 60 minutes in `lib/levels.ts`, but `MAX_EFFECTIVE_MINUTES = 5` clamps the
  target and stops level-ups past level 4.
  **TODO: chunked upload.** Record in self-contained pieces of about 4 minutes, transcribe
  each piece in memory, then combine the transcripts server-side, keeping audio out of
  storage. Then raise `MAX_EFFECTIVE_MINUTES` here and in `public.apply_level_up()`.
- iOS Safari may ignore the requested bitrate. The app refuses uploads over 4.4 MB with
  a clear message.
- No offline mode (no service worker).
- `next dev` may recreate an `AGENTS.md` file when it detects an AI coding tool. It's
  safe to delete or ignore.

## License

MIT, see [LICENSE](LICENSE).
