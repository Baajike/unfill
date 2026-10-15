"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { wordIdSchema } from "@/lib/validation";

/** Hides a word from "Words to try" and stops it being counted. Changes the status only. */
export async function dismissWord(formData: FormData): Promise<void> {
  const parsed = wordIdSchema.safeParse(formData.get("id"));
  if (!parsed.success) return;

  const { supabase, user } = await getUser();
  if (!user) return;

  const { error } = await supabase
    .from("word_bank")
    .update({ status: "dismissed" })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .in("status", ["new", "used"]);
  if (error) {
    console.warn("[words] dismiss failed");
    return;
  }

  revalidatePath("/words");
  revalidatePath("/");
}
