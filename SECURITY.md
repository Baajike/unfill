# Security

## What data Unfill handles

| Data | Where it goes | Stored? |
| --- | --- | --- |
| Email and password | Supabase Auth (passwords are hashed by Supabase) | Yes, by Supabase |
| Timezone (e.g. `Europe/London`) | `profiles` table | Yes |
| **Audio recordings** | Sent from the browser to `/api/analyze`, then streamed in memory to Groq for transcription | **No.** Never written to disk, a database or storage |
| Transcript | Groq (it produces it), Google Gemini or Groq (for feedback), `sessions` table | Yes, in your own rows |
| Metrics and feedback | `sessions` table | Yes, in your own rows |

Third parties: audio is processed by **Groq**, and transcripts by **Google (Gemini API)**,
or by Groq when Gemini is unavailable. Their own data policies apply. On the free Gemini
API tier, Google may use submitted content to improve its products, so don't say anything
in a session you wouldn't want processed that way.

## How keys are kept server-side

- `GROQ_API_KEY` and `GEMINI_API_KEY` are read only in `lib/ai/*`, which imports
  `server-only` so the build fails if those modules are ever pulled into browser code.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the browser.
  Both are designed to be public; Row Level Security protects the data.
- The Supabase `service_role` key is not used anywhere.
- `.env*` files are git-ignored (except `.env.example`, which has placeholders only).

## Protections in place

- **Authentication**: every page goes through `proxy.ts`, which redirects signed-out users
  to `/login`. Each page and `/api/analyze` also verifies the user with Supabase Auth on
  the server. A user id from the client is never trusted.
- **Row Level Security** on `profiles` and `sessions`: users can only select, insert and
  update their own rows. Deletes are denied. Column privileges stop users changing their
  own level or backdating sessions. Levels change only through `apply_level_up()`, which
  checks the rule itself.
- **Upload validation** in `/api/analyze`: multipart only, an allowed audio MIME type, a
  check of the file's magic bytes, and at most 25 MB (Vercel's 4.5 MB request limit
  applies first). The topic must come from the built-in list, and the session length and
  target come from the server, not the client.
- **Rate limit**: 15 analyses per user per rolling 24 hours, counted from `sessions` on
  the server.
- **Prompt injection**: the transcript is wrapped in delimiters and the model is told to
  treat it as data only. The output must be JSON that passes a zod schema, and word
  suggestions must quote the real transcript.
- **Headers**: a strict per-request nonce-based Content-Security-Policy, plus
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` and a
  `Permissions-Policy` that allows only the microphone, only for this site.
- **Errors and logs**: the client only sees generic messages. Server logs record the kind
  of failure and HTTP status codes only: never transcripts, audio, prompts or keys.

## Known limitations

- Because users can insert and update their own `sessions` rows (as RLS allows), someone
  using the Supabase API directly with their own login could write fake sessions to inflate
  their own streak or level. This only affects their own data. Fixing it fully needs a
  server-only service-role key, which this project avoids.
- Requests that fail before a session is saved (for example audio under 30 seconds) don't
  count toward the daily limit. Groq's own free-tier limits still apply.

## Reporting a vulnerability

Please report privately using GitHub's **Security → Report a vulnerability** (private
vulnerability reporting) on this repository. Don't open a public issue. Include steps to
reproduce, and you'll get a reply as soon as possible.
