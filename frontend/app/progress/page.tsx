"use client";

import { motion, type Variants, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Filter,
  LineChart,
  Loader2,
  NotebookPen,
  Search,
  Target,
  CircleSlash,
  Binary,
  Hash,
} from "lucide-react";

import { apiFetch } from "../auxiliary/apiFetch";
import { mapHabit } from "../auxiliary/mapHabit";
import {
  Habit,
  HabitEntryResponse,
  HabitResponseDto,
} from "../dto/Habit";
import { getCurrentUserId } from "../auxiliary/getCurrentUserId";
import { fetchUserNamesByIds } from "../auxiliary/fetchUserNames";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import SectionTitle from "../components/SectionTitle";
import StatPill from "../components/StatPill";
import { itemVariants } from "../auxiliary/variants/itemVariant";
import { containerVariants } from "../auxiliary/variants/containerVariants";

async function fetchHabitsForMember(memberId: string): Promise<Habit[]> {
  const dtos = await apiFetch<HabitResponseDto[]>(
    `/api/habits?memberId=${memberId}`,
    { method: "GET" }
  );
  return dtos.map(mapHabit);
}

async function fetchEntriesForHabit(habitId: string): Promise<HabitEntryResponse[]> {
  return apiFetch<HabitEntryResponse[]>(`/api/habits/${habitId}/entries`, {
    method: "GET",
  });
}

type HabitWithEntries = Habit & {
  entries: HabitEntryResponse[];
};


function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ProgressPage() {
  const [habitLogs, setHabitLogs] = useState<HabitWithEntries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      if (!currentUserId) {
        setError("Could not determine current user.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const habits = await fetchHabitsForMember(currentUserId);
        const habitsWithEntries = await Promise.all(
          habits.map(async (habit) => {
            const entries = await fetchEntriesForHabit(habit.id);
            return { ...habit, entries };
          })
        );
        const ids = habitsWithEntries.flatMap((habit) =>
            habit.entries.map((entry) => entry.memberId)
        );
        const newMemberNames = await fetchUserNamesByIds(ids);

        if (cancelled) return;

        setUserMap((prev) => ({ ...prev, ...newMemberNames }));
        setHabitLogs(habitsWithEntries);
        if (!selectedHabitId && habitsWithEntries.length > 0) {
            setSelectedHabitId(habitsWithEntries[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load progress.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const filteredHabits = useMemo(() => {
    return habitLogs.filter((habit) => {
      const matchesSearch = habit.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" ? true : habit.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [habitLogs, search, filter]);

  const selectedHabit =
    filteredHabits.find((habit) => habit.id === selectedHabitId) ??
    filteredHabits[0] ??
    null;

  const selectedEntries = useMemo(() => {
    if (!selectedHabit) return [];
    return [...selectedHabit.entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [selectedHabit]);

  const totalEntries = habitLogs.reduce((sum, habit) => sum + habit.entries.length, 0);
  const loggedEntries = habitLogs.reduce(
    (sum, habit) => sum + habit.entries.filter((entry) => entry.status === "Logged").length,
    0
  );
  const skippedEntries = habitLogs.reduce(
    (sum, habit) => sum + habit.entries.filter((entry) => entry.status === "Skipped").length,
    0
  );

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
          title="Progress"
          subtitle="Review all recorded habit logs in one place."
          activePage="progress"
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
          className="mt-6 grid grid-cols-1 gap-5"
        >
          <motion.div variants={itemVariants}>
            <Card>
              <SectionTitle
                icon={<LineChart className="h-5 w-5" />}
                title="Logs Overview"
                subtitle="A quick snapshot of all saved habit entries"
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <StatPill label="Total Logs" value={totalEntries} accent="indigo" />
                <StatPill label="Logged" value={loggedEntries} accent="emerald" />
                <StatPill label="Skipped" value={skippedEntries} accent="cyan" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_1.7fr]"
          >
            <Card className="min-h-[560px]">
              <SectionTitle
                icon={<Target className="h-5 w-5" />}
                title="Habits"
                subtitle="Choose a habit to inspect its entries"
              />

              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search habits"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:bg-white/10"
                  />
                </div>

                <div className="relative sm:w-52">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <select
                    value={filter}
                    onChange={(e) =>
                      setFilter(e.target.value as "all" | "active" | "archived")
                    }
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white outline-none transition focus:border-white/20 focus:bg-white/10"
                  >
                    <option value="all" className="bg-[#0D1117]">
                      All statuses
                    </option>
                    <option value="active" className="bg-[#0D1117]">
                      Active
                    </option>
                    <option value="archived" className="bg-[#0D1117]">
                      Archived
                    </option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                  <p className="text-sm text-white/50">Loading progress…</p>
                </div>
              ) : filteredHabits.length === 0 ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 text-center">
                  <Activity className="h-6 w-6 text-white/30" />
                  <p className="text-sm text-white/50">No habits match your filters.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHabits.map((habit) => {
                    const isSelected = habit.id === selectedHabit?.id;
                    const loggedCount = habit.entries.filter((e) => e.status === "Logged").length;
                    const skippedCount = habit.entries.filter((e) => e.status === "Skipped").length;

                    return (
                      <motion.button
                        key={habit.id}
                        type="button"
                        whileHover={{ y: -2, scale: 1.01 }}
                        onClick={() => setSelectedHabitId(habit.id)}
                        className={[
                          "w-full rounded-[24px] border p-5 text-left transition",
                          isSelected
                            ? "border-emerald-400/30 bg-emerald-400/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-semibold text-white">
                                {habit.name}
                              </h3>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  habit.type === "binary"
                                    ? "bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20"
                                    : "bg-fuchsia-400/10 text-fuchsia-300 ring-1 ring-fuchsia-400/20"
                                }`}
                              >
                                {habit.type}
                              </span>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  habit.status === "active"
                                    ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
                                    : "bg-indigo-400/10 text-indigo-300 ring-1 ring-indigo-400/20"
                                }`}
                              >
                                {habit.status}
                              </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/60">
                              {habit.goal && (
                                <span className="rounded-full bg-white/6 px-3 py-1">
                                  Goal: {habit.goal}
                                  {habit.unit ? ` ${habit.unit}` : ""}
                                </span>
                              )}
                              <span className="rounded-full bg-white/6 px-3 py-1">
                                Logs: {habit.entries.length}
                              </span>
                              <span className="rounded-full bg-white/6 px-3 py-1">
                                Logged: {loggedCount}
                              </span>
                              <span className="rounded-full bg-white/6 px-3 py-1">
                                Skipped: {skippedCount}
                              </span>
                            </div>
                          </div>

                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/35" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="min-h-[560px]">
              <SectionTitle
                icon={<NotebookPen className="h-5 w-5" />}
                title={selectedHabit ? `${selectedHabit.name} Logs` : "Entries"}
                subtitle={
                  selectedHabit
                    ? "Chronological history of all recorded logs for this habit"
                    : "Select a habit on the left"
                }
              />

              {!selectedHabit ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 text-center">
                  <Target className="h-6 w-6 text-white/30" />
                  <p className="text-sm text-white/50">Pick a habit to inspect its entries.</p>
                </div>
              ) : selectedEntries.length === 0 ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 text-center">
                  <CircleSlash className="h-6 w-6 text-white/30" />
                  <p className="text-sm text-white/50">No logs yet for this habit.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {selectedEntries.map((entry) => (
                      <motion.div
                        key={entry.habitEntryId}
                        layout
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        whileHover={{ y: -2 }}
                        className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  entry.status === "Logged"
                                    ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
                                    : "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20"
                                }`}
                              >
                                {entry.status}
                              </span>

                              {selectedHabit.type === "binary" ? (
                                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300 ring-1 ring-cyan-400/20">
                                  <Binary className="h-3.5 w-3.5" />
                                  Binary
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 rounded-full bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-300 ring-1 ring-fuchsia-400/20">
                                  <Hash className="h-3.5 w-3.5" />
                                  {entry.value ?? 0}
                                  {selectedHabit.unit ? ` ${selectedHabit.unit}` : ""}
                                </span>
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/60">
                              <span className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1">
                                <CalendarDays className="h-4 w-4 text-white/35" />
                                {formatDate(entry.date)}
                              </span>

                              <span className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1">
                                <CheckCircle2 className="h-4 w-4 text-white/35" />
                                Member: {userMap[entry.memberId] ?? entry.memberId}
                              </span>
                            </div>

                            {entry.notes && (
                              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                                  Note
                                </p>
                                <p className="mt-2 text-sm leading-6 text-white/80">
                                  {entry.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          </motion.div>
        </motion.section>
      </motion.div>
    </main>
  );
}