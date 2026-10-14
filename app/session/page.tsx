import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { Recorder } from "@/components/Recorder";
import { targetSecondsForLevel } from "@/lib/levels";
import { getUser } from "@/lib/supabase/server";
import { RECENT_TOPICS_TO_AVOID, pickTopics } from "@/lib/topics";

export default async function SessionPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const [profileRes, recentRes] = await Promise.all([
    supabase.from("profiles").select("current_level").eq("id", user.id).single(),
    supabase
      .from("sessions")
      .select("topic")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(RECENT_TOPICS_TO_AVOID),
  ]);

  const targetSeconds = targetSecondsForLevel(profileRes.data?.current_level ?? 1);
  // Two topics: the second is the one allowed skip.
  const topics = pickTopics(
    (recentRes.data ?? []).map((s) => s.topic),
    2,
    (max) => randomInt(max),
  );

  return <Recorder topics={topics} targetSeconds={targetSeconds} />;
}
