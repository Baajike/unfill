import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { Recorder } from "@/components/Recorder";
import { StandaloneNotice } from "@/components/StandaloneNotice";
import { WordsToTry } from "@/components/WordsToTry";
import { targetSecondsForLevel } from "@/lib/levels";
import { getUser } from "@/lib/supabase/server";
import { DEFAULT_CATEGORY, RECENT_TOPICS_TO_AVOID, parseCategory, pickTopics } from "@/lib/topics";
import { WORDS_TO_TRY } from "@/lib/word-bank";

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  // Only a category id from the fixed list is accepted. Anything else falls back to Random.
  const requested = (await searchParams).category;
  const category = requested === undefined ? DEFAULT_CATEGORY : parseCategory(requested);
  if (category === null) redirect("/session");

  const recentQuery = () =>
    supabase
      .from("sessions")
      .select("topic")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(RECENT_TOPICS_TO_AVOID);

  const [profileRes, recentRes, recentInCategoryRes, wordsRes] = await Promise.all([
    supabase.from("profiles").select("current_level").eq("id", user.id).single(),
    recentQuery(),
    // Sessions saved before categories existed have no category, so the overall
    // list above also counts.
    category === "random" ? null : recentQuery().eq("topic_category", category),
    supabase
      .from("word_bank")
      .select("phrase")
      .eq("user_id", user.id)
      .eq("status", "new")
      .order("created_at", { ascending: true })
      .limit(WORDS_TO_TRY),
  ]);

  const targetSeconds = targetSecondsForLevel(profileRes.data?.current_level ?? 1);
  const recentTexts = [...(recentRes.data ?? []), ...(recentInCategoryRes?.data ?? [])].map(
    (s) => s.topic,
  );
  // Two topics: the second is the one allowed skip.
  const topics = pickTopics(category, recentTexts, 2, (max) => randomInt(max));

  const wordsToTry = (wordsRes.data ?? []).map((w) => w.phrase);

  // The notice slot sits under the topic, just above Start.
  return (
    <Recorder
      topics={topics}
      targetSeconds={targetSeconds}
      notice={
        <>
          <WordsToTry words={wordsToTry} className="mb-4" />
          <StandaloneNotice />
        </>
      }
    />
  );
}
