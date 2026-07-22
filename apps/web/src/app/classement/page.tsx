import { apiFetch } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";
import { ClassementContent } from "@/components/classement-content";

export default async function ClassementPage() {
  const { leaderboard } = await apiFetch<{ leaderboard: LeaderboardEntry[] }>("/users/leaderboard");
  return <ClassementContent leaderboard={leaderboard} />;
}
