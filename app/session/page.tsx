import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { Recorder } from "@/components/Recorder";
import { StandaloneNotice } from "@/components/StandaloneNotice";
import { targetSecondsForLevel } from "@/lib/levels";
import { getUser } from "@/lib/supabase/server";
import { DEFAULT_CATEGORY, RECENT_TOPICS_TO_AVOID, parseCategory, pickTopics } from "@/lib/topics";

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

  const [profileRes, recentRes, recentInCategoryRes] = await Promise.all([
    supabase.from("profiles").select("current_level").eq("id", user.id).single(),
    recentQuery(),
    // Sessions saved before categories existed have no category, so the overall
    // list above also counts.
    category === "random" ? null : recentQuery().eq("topic_category", category),
  ]);

  const targetSeconds = targetSecondsForLevel(profileRes.data?.current_level ?? 1);
  const recentTexts = [...(recentRes.data ?? []), ...(recentInCategoryRes?.data ?? [])].map(
    (s) => s.topic,
  );
  // Two topics: the second is the one allowed skip.
  const topics = pickTopics(category, recentTexts, 2, (max) => randomInt(max));

  return <Recorder topics={topics} targetSeconds={targetSeconds} notice={<StandaloneNotice />} />;
}
