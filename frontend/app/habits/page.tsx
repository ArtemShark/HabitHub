"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Archive,
  Trash2,
  Flame,
  CheckCircle2,
  CalendarDays,
  Target,
  Trophy,
} from "lucide-react";
import { Habit, HabitFormData, HabitResponseDto, UpdateHabitRequestDto, HabitStatus } from "../dto/Habit";
import { mapHabit } from "../auxiliary/mapHabit";
import { apiFetch } from "../auxiliary/apiFetch";
import { getCurrentUserId } from "../auxiliary/getCurrentUserId";

import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import SectionTitle from "../components/SectionTitle";
import StatPill from "../components/StatPill";
import HabitFormModal from "../components/HabitFormModal";
import { itemVariants } from "../auxiliary/variants/itemVariant";
import { containerVariants } from "../auxiliary/variants/containerVariants";
import { useRouter } from "next/navigation";


async function fetchHabitsForMember(memberId: string): Promise<Habit[]> {
  const dtos = await apiFetch<HabitResponseDto[]>(`/api/habits?memberId=${memberId}`, {
    method: "GET",
  });
  return dtos.map(mapHabit);
}

async function updateHabit(habitId: string, payload: UpdateHabitRequestDto): Promise<Habit> {
  const dto = await apiFetch<HabitResponseDto>(`/api/habits/${habitId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapHabit(dto);
}

async function archiveHabit(habitId: string): Promise<Habit> {
  const dto = await apiFetch<HabitResponseDto>(`/api/habits/${habitId}/archive`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return mapHabit(dto);
}

async function deleteHabit(habitId: string): Promise<void> {
  await apiFetch<void>(`/api/habits/${habitId}`, {
    method: "DELETE",
  });
}


export default function HabitsPage() {
  const router = useRouter();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activeTab, setActiveTab] = useState<HabitStatus>("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  useEffect(() => {
    async function load() {
      if (!currentUserId) {
        setError("Could not determine current user.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await fetchHabitsForMember(currentUserId);
        setHabits(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load habits.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [currentUserId]);

  const editingHabit = habits.find((habit) => habit.id === editingHabitId);

  const modalInitialData: HabitFormData = editingHabit
    ? {
        name: editingHabit.name,
        type: editingHabit.type,
        goal: editingHabit.goal?.toString() ?? "",
        unit: editingHabit.unit ?? "",
        endDate: editingHabit.endDate
          ? new Date(editingHabit.endDate).toISOString().slice(0, 10)
          : "",
      }
    : {
        name: "",
        type: "binary",
        goal: "",
        unit: "",
        endDate: "",
      };

  const visibleHabits = useMemo(
    () => habits.filter((habit) => habit.status === activeTab),
    [habits, activeTab]
  );

  const activeCount = habits.filter((h) => h.status === "active").length;
  const archivedCount = habits.filter((h) => h.status === "archived").length;

  const openEditModal = (habitId: string) => {
    setEditingHabitId(habitId);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHabitId(null);
  };

  const openLeaderboard = (habitId: string) => {
    router.push(`/habits/${habitId}/leaderboard`);
  };

  const handleSubmitHabit = async (data: HabitFormData) => {
    if (!editingHabitId) return;

    try {
      setError("");
      setSuccess("");

      const payload: UpdateHabitRequestDto = {
        name: data.name.trim(),
        habitType: data.type,
        goal: data.type === "quantitative" && data.goal ? data.goal : null,
        unit: data.type === "quantitative" ? data.unit.trim() || null : null,
        expiryDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      };

      console.log("PATCH payload:", payload);

      const updated = await updateHabit(editingHabitId, payload);

      setHabits((prev) =>
        prev.map((habit) => (habit.id === editingHabitId ? updated : habit))
      );

      setSuccess("Habit updated successfully.");
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update habit.");
    }
  };

  const handleArchiveHabit = async (habitId: string) => {
    try {
      setError("");
      setSuccess("");
      const updated = await archiveHabit(habitId);
      setHabits((prev) => prev.map((habit) => (habit.id === habitId ? updated : habit)));
      setSuccess("Habit archived successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive habit.");
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    try {
      setError("");
      setSuccess("");
      await deleteHabit(habitId);
      setHabits((prev) => prev.filter((habit) => habit.id !== habitId));
      setSuccess("Habit deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete habit.");
    }
  };

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
          title="Habits"
          subtitle="Manage, update, archive, and track all team habits in one place."
          activePage="habits"
        />

        {(error || success) && (
          <div className="mt-6 space-y-3">
            {error && (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                {success}
              </div>
            )}
          </div>
        )}

        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_2fr]"
        >
          <motion.div variants={itemVariants}>
            <Card>
              <SectionTitle
                icon={<Flame className="h-5 w-5" />}
                title="Habit Overview"
                subtitle="Quick insight into your current collection"
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <StatPill label="Active" value={activeCount} />
                <StatPill label="Archived" value={archivedCount} />
                <StatPill label="Total" value={habits.length} />
              </div>

              <button
                disabled
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white/50 cursor-not-allowed"
              >
                Create endpoint not added yet
              </button>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <SectionTitle
                icon={<Target className="h-5 w-5" />}
                title="Habit Management"
                subtitle="View and update your active and archived habits"
              />

              <div className="mb-5 flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab("active")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    activeTab === "active"
                      ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Active Habits
                </button>

                <button
                  onClick={() => setActiveTab("archived")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    activeTab === "archived"
                      ? "bg-indigo-400/15 text-indigo-300 ring-1 ring-indigo-400/30"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Archived Habits
                </button>
              </div>

              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-center"
                    >
                      <p className="text-lg font-medium text-white/80">Loading habits...</p>
                    </motion.div>
                  ) : visibleHabits.length > 0 ? (
                    visibleHabits.map((habit) => (
                      <motion.div
                        key={habit.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        whileHover={{ y: -2 }}
                        className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-white">{habit.name}</h3>

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

                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/65">
                              {habit.goal !== undefined && (
                                <span className="rounded-xl bg-white/5 px-3 py-2">
                                  Goal: {habit.goal} {habit.unit}
                                </span>
                              )}

                              {habit.endDate && (
                                <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                                  <CalendarDays className="h-4 w-4" />
                                  {new Date(habit.endDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 xl:w-auto xl:flex-col">
                            <button
                              onClick={() => openEditModal(habit.id)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>

                            {habit.status === "active" ? (
                              <button
                                onClick={() => void handleArchiveHabit(habit.id)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-2.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-400/15"
                              >
                                <Archive className="h-4 w-4" />
                                Archive
                              </button>
                            ) : (
                              <button
                                disabled
                                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/40 cursor-not-allowed"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Restore unavailable
                              </button>
                            )}

                            <button
                              onClick={() => void handleDeleteHabit(habit.id)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-400/15"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>

                            <button
                            onClick={() => void openLeaderboard(habit.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/15"
                          >
                            <Trophy className="h-4 w-4" />
                            View Leaderboard
                          </button>
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
                        No {activeTab} habits yet
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>
        </motion.section>
      </motion.div>

      <HabitFormModal
        open={isModalOpen}
        initialData={modalInitialData}
        onClose={closeModal}
        onSubmit={(data) => void handleSubmitHabit(data)}
      />
    </main>
  );
}