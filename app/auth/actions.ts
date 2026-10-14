"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/streak";
import { credentialsSchema } from "@/lib/validation";

export type AuthState = { error: string | null };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function saveTimezoneIfMissing(supabase: SupabaseServerClient, timezone: FormDataEntryValue | null) {
  if (!isValidTimeZone(timezone)) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // Only the first value is kept; later logins never overwrite it.
  await supabase.from("profiles").update({ timezone }).eq("id", user.id).is("timezone", null);
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "That email and password didn't match." };

  await saveTimezoneIfMissing(supabase, formData.get("timezone"));
  redirect("/");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    console.warn(`[auth] sign up failed: ${error.code ?? error.status ?? "unknown"}`);
    return { error: "We couldn't create that account. Try a different email or password." };
  }
  if (!data.session) {
    // Happens when "Confirm email" is still enabled in Supabase.
    return { error: "Account created. Check your email to confirm it, then sign in." };
  }

  await saveTimezoneIfMissing(supabase, formData.get("timezone"));
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
