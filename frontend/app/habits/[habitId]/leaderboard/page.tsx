"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { Trophy, Medal, Users, Target, TrendingUp } from "lucide-react";

import { apiFetch } from "../../../auxiliary/apiFetch";
import PageHeader from "../../../components/PageHeader";
import Card from "../../../components/Card";
import SectionTitle from "../../../components/SectionTitle";
import StatPill from "../../../components/StatPill";
import { itemVariants } from "../../../auxiliary/variants/itemVariant";
import { containerVariants } from "../../../auxiliary/variants/containerVariants";

type LeaderboardMemberResponse = {
  memberId: string;
  username: string;
  totalProgress: number;
  rank: number;
};

type LeaderboardResponse = {
  habitId: string;
  habitName: string;
  entries: LeaderboardMemberResponse[];
};

async function fetchLeaderboard(habitId: string): Promise<LeaderboardResponse> {
  return apiFetch<LeaderboardResponse>(`/api/habits/${habitId}/leaderboard`, {
    method: "GET",
  });
}

export default function LeaderboardPage() {
  const params = useParams();
  const habitId = params.habitId as string;

  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchLeaderboard(habitId);
        setLeaderboard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
      } finally {
        setLoading(false);
      }
    }

    if (habitId) void load();
  }, [habitId]);

  const members = leaderboard?.entries ?? [];
  const topMember = members[0];
  const totalProgress = members.reduce((sum, member) => sum + member.totalProgress, 0);

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090F] px-4 py-6 text-white sm:px-6 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.10),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative mx-auto max-w-7xl rounded-[36px] border border-white/10 bg-black/35 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5 md:rounded-[42px] md:p-7"
      >
        <PageHeader
          title="Leaderboard"
          subtitle="Compare member progress and see who is leading this habit."
          activePage="habits"
        />

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_2fr]"
        >
          <motion.div variants={itemVariants}>
            <Card>
              <SectionTitle
                icon={<Trophy className="h-5 w-5" />}
                title="Overview"
                subtitle={leaderboard?.habitName ?? "Habit leaderboard summary"}
              />

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <StatPill label="Members" value={members.length} />
                <StatPill label="Total Progress" value={totalProgress} />
                <StatPill label="Leader" value={topMember?.username ?? "—"} />
              </div>

              {topMember && (
                <div className="mt-5 rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-amber-400/15 p-3 text-amber-300">
                      <Medal className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-amber-200/80">Current leader</p>
                      <p className="text-xl font-semibold text-white">{topMember.username}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-white/65">
                    Total progress:{" "}
                    <span className="font-semibold text-white">{topMember.totalProgress}</span>
                  </p>
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <SectionTitle
                icon={<Users className="h-5 w-5" />}
                title="Member Ranking"
                subtitle="Progress is ordered from highest to lowest"
              />

              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-center"
                    >
                      <p className="text-lg font-medium text-white/80">Loading leaderboard...</p>
                    </motion.div>
                  ) : members.length > 0 ? (
                    members.map((member) => (
                      <motion.div
                        key={member.memberId}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        whileHover={{ y: -2 }}
                        className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${
                                member.rank === 1
                                  ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25"
                                  : member.rank === 2
                                  ? "bg-slate-300/15 text-slate-200 ring-1 ring-slate-300/25"
                                  : member.rank === 3
                                  ? "bg-orange-400/15 text-orange-300 ring-1 ring-orange-400/25"
                                  : "bg-white/10 text-white/70"
                              }`}
                            >
                              #{member.rank}
                            </div>

                            <div>
                              <h3 className="text-lg font-semibold text-white">{member.username}</h3>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-400/20">
                              <TrendingUp className="h-4 w-4" />
                              {member.totalProgress}
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-xl bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300 ring-1 ring-cyan-400/20">
                              <Target className="h-4 w-4" />
                              Progress
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-center"
                    >
                      <p className="text-lg font-medium text-white/80">
                        No leaderboard entries yet
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>
        </motion.section>
      </motion.div>
    </main>
  );
}