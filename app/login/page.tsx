"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";

const initial: AuthState = { error: null };

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signingIn] = useActionState(signIn, initial);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, initial);

  const isSignUp = mode === "signup";
  const state = isSignUp ? signUpState : signInState;
  const pending = signingIn || signingUp;

  const input =
    "min-h-14 w-full rounded-field border border-border bg-field px-4 text-base outline-none transition " +
    "placeholder:text-label focus:border-primary focus:bg-white";
  const label = "text-sm font-bold text-ink";

  return (
    <div className="flex flex-1 flex-col justify-center animate-rise">
      <div className="flex flex-col items-center text-center">
        <Logo size="lg" />
        <h1 className="mt-5 text-[2rem] leading-tight font-extrabold tracking-tight">Unfill</h1>
        <p className="mt-2 text-muted">
          Speak a little every day.
          <br />
          Say less filler.
        </p>
      </div>

      <div className="mt-8 rounded-card border border-white bg-white/86 p-6 shadow-card backdrop-blur-md">
        <form action={isSignUp ? signUpAction : signInAction} className="flex flex-col gap-4">
          <input
            type="hidden"
            name="timezone"
            ref={(el) => {
              // defaultValue too, so React's post-action form reset keeps it.
              if (el) el.defaultValue = el.value = browserTimeZone();
            }}
          />
          <div className="flex flex-col gap-1.5">
            <label className={label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="Email"
              required
              maxLength={254}
              className={input}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder={isSignUp ? "Password (8+ characters)" : "Password"}
              required
              minLength={8}
              maxLength={72}
              className={input}
            />
          </div>

          <p className="min-h-6 text-sm font-semibold text-peach-ink" role="status" aria-live="polite">
            {state.error}
          </p>

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "One moment" : isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

        <Button
          variant="ghost"
          size="md"
          className="mt-2 w-full"
          onClick={() => setMode(isSignUp ? "signin" : "signup")}
        >
          {isSignUp ? "I already have an account" : "New here? Create an account"}
        </Button>
      </div>

      <ul aria-hidden className="mt-6 flex justify-center gap-2">
        <li className="inline-flex h-8 items-center rounded-full bg-mint px-3.5 text-[0.8125rem] font-bold text-mint-ink">
          Speak
        </li>
        <li className="inline-flex h-8 items-center rounded-full bg-peach px-3.5 text-[0.8125rem] font-bold text-peach-ink">
          Reflect
        </li>
        <li className="inline-flex h-8 items-center rounded-full bg-lavender px-3.5 text-[0.8125rem] font-bold text-lavender-ink">
          Grow
        </li>
      </ul>
    </div>
  );
}
