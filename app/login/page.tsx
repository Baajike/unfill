"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/Button";

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
    "min-h-14 w-full rounded-2xl border border-line bg-paper px-4 text-lg outline-none transition " +
    "placeholder:text-faint focus:border-accent";

  return (
    <div className="flex flex-1 flex-col justify-center animate-rise">
      <h1 className="text-4xl font-semibold tracking-tight">Unfill</h1>
      <p className="mt-2 text-lg text-muted">Speak a little every day. Say less filler.</p>

      <form
        action={isSignUp ? signUpAction : signInAction}
        className="mt-10 flex flex-col gap-3"
      >
        <input
          type="hidden"
          name="timezone"
          ref={(el) => {
            // defaultValue too, so React's post-action form reset keeps it.
            if (el) el.defaultValue = el.value = browserTimeZone();
          }}
        />
        <label className="sr-only" htmlFor="email">
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
        <label className="sr-only" htmlFor="password">
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

        <p className="min-h-6 text-sm text-muted" role="status" aria-live="polite">
          {state.error}
        </p>

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "One moment" : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <Button
        variant="ghost"
        size="md"
        className="mt-4"
        onClick={() => setMode(isSignUp ? "signin" : "signup")}
      >
        {isSignUp ? "I already have an account" : "New here? Create an account"}
      </Button>
    </div>
  );
}
