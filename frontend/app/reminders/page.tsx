"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  Clock,
  Loader2,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

import { apiFetch } from "../auxiliary/apiFetch";
import { getCurrentUserId } from "../auxiliary/getCurrentUserId";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { itemVariants } from "../auxiliary/variants/itemVariant";
import { containerVariants } from "../auxiliary/variants/containerVariants";

type ReminderDto = {
  reminderId: string;
  memberId: string;
  habitId: string;
  habitName: string;
  enabled: boolean;
  lastSentAt: string | null;
  reminderTime: string | null;
};

type TeamDto = {
  habitTeamId: string;
  name: string;
  creatorId: string;
};

type HabitDto = {
  habitId: string;
  habitTeamId: string;
  creatorId: string;
  name: string;
  habitState: string;
  reminderTime?: string | null;
};

type ReminderHabitOption = {
  id: string;
  name: string;
  teamId: string;
  reminderTime?: string | null;
};

async function fetchMyReminders(): Promise<ReminderDto[]> {
  return apiFetch<ReminderDto[]>("/api/reminders/my", { method: "GET" });
}

async function fetchTeams(): Promise<TeamDto[]> {
  return apiFetch<TeamDto[]>("/api/teams", { method: "GET" });
}

async function fetchTeamHabits(teamId: string): Promise<HabitDto[]> {
  return apiFetch<HabitDto[]>(`/api/teams/${teamId}/habits?state=Active`, {
    method: "GET",
  });
}

function formatLastSent(iso: string | null): string {
  if (!iso) return "Never sent";

  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours < 1) return "Less than an hour ago";
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";

  return `${diffDays} days ago`;
}

function formatReminderTime(iso: string | null): string {
  if (!iso) return "No time set";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReminderToggle({
  enabled,
  onToggle,
  loading,
}: {
  enabled: boolean;
  onToggle: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-300 focus:outline-none ${
        enabled
          ? "border-indigo-500 bg-indigo-500/30"
          : "border-white/15 bg-white/5"
      } disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className={`pointer-events-none inline-block h-4 w-4 self-center rounded-full shadow-lg ring-0 transition-transform ${
          enabled
            ? "translate-x-5 bg-indigo-400"
            : "translate-x-0.5 bg-white/30"
        }`}
      />

      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-3 w-3 animate-spin text-white/60" />
        </span>
      )}
    </button>
  );
}

function ReminderCard({
  reminder,
  onToggle,
}: {
  reminder: ReminderDto;
  onToggle: (habitId: string, enabled: boolean) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [optimisticEnabled, setOptimisticEnabled] = useState(reminder.enabled);

  useEffect(() => {
    setOptimisticEnabled(reminder.enabled);
  }, [reminder.enabled]);

  const handleToggle = async () => {
    const nextEnabled = !optimisticEnabled;

    setToggling(true);
    setOptimisticEnabled(nextEnabled);

    try {
      await onToggle(reminder.habitId, nextEnabled);
    } catch {
      setOptimisticEnabled(!nextEnabled);
    } finally {
      setToggling(false);
    }
  };

  return (
    <motion.div
      layout
      variants={itemVariants}
      whileHover={{ y: -2, scale: 1.005 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/8"
    >
      <AnimatePresence>
        {optimisticEnabled && (
          <motion.div
            key="glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 rounded-2xl border border-indigo-500/20 bg-indigo-500/5"
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
              optimisticEnabled
                ? "bg-indigo-500/15 text-indigo-300"
                : "bg-white/8 text-white/35"
            }`}
          >
            {optimisticEnabled ? (
              <BellRing className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </div>

          <div>
            <p className="font-medium text-white/90">{reminder.habitName}</p>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {reminder.reminderTime ? (
                <span className="flex items-center gap-1 text-xs text-white/45">
                  <Clock className="h-3 w-3" />
                  {formatReminderTime(reminder.reminderTime)}
                </span>
              ) : (
                <span className="text-xs text-white/30">No reminder time set</span>
              )}

              <span className="text-xs text-white/30">·</span>

              <span className="text-xs text-white/40">
                {formatLastSent(reminder.lastSentAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium transition-colors ${
              optimisticEnabled ? "text-indigo-300" : "text-white/30"
            }`}
          >
            {optimisticEnabled ? "On" : "Off"}
          </span>

          <ReminderToggle
            enabled={optimisticEnabled}
            onToggle={handleToggle}
            loading={toggling}
          />
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ canSetReminder }: { canSetReminder: boolean }) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
        <Bell className="h-6 w-6 text-indigo-300/60" />
      </div>

      <div>
        <p className="font-medium text-white/60">No reminders yet</p>
        <p className="mt-2 max-w-sm text-sm text-white/35">
          {canSetReminder
            ? "Use Set Reminder to configure a reminder time for one of your active team habits."
            : "Your team creator has not configured reminders for your active habits yet."}
        </p>
      </div>
    </div>
  );
}

function StatsStrip({ reminders }: { reminders: ReminderDto[] }) {
  const total = reminders.length;
  const active = reminders.filter((reminder) => reminder.enabled).length;
  const inactive = total - active;

  const stats = [
    { label: "Total habits", value: total, color: "text-white/80" },
    { label: "Active reminders", value: active, color: "text-indigo-300" },
    { label: "Muted", value: inactive, color: "text-white/40" },
  ];

  return (
    <div className="mb-5 grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          variants={itemVariants}
          className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-center"
        >
          <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
          <p className="mt-0.5 text-xs text-white/40">{stat.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

type SetReminderModalProps = {
  open: boolean;
  onClose: () => void;
  habits: { id: string; name: string }[];
  onSubmit: (habitId: string, time: string) => Promise<void>;
};

function SetReminderModal({
  open,
  onClose,
  habits,
  onSubmit,
}: SetReminderModalProps) {
  const [habitId, setHabitId] = useState("");
  const [time, setTime] = useState("13:20");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) return;

    setSuccess(false);
    setSubmitError("");

    if (!habitId && habits.length > 0) {
      setHabitId(habits[0].id);
    }

    if (habitId && habits.every((habit) => habit.id !== habitId)) {
      setHabitId(habits[0]?.id ?? "");
    }
  }, [open, habits, habitId]);

  const handleSubmit = async () => {
    if (!habitId || !time) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const [hours, minutes] = time.split(":").map(Number);
      const reminderDate = new Date();

      reminderDate.setHours(hours, minutes, 0, 0);

      await onSubmit(habitId, reminderDate.toISOString());

      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 900);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to set reminder."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15">
                    <Bell className="h-4 w-4 text-indigo-300" />
                  </div>

                  <h3 className="text-xl font-semibold text-white">Set Reminder</h3>
                </div>

                <p className="text-sm text-white/45">
                  Configure when members get notified for a habit.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {submitError && (
              <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {submitError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/60">Habit</label>

                <select
                  value={habitId}
                  onChange={(event) => setHabitId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-indigo-500/50"
                >
                  {habits.map((habit) => (
                    <option key={habit.id} value={habit.id} className="bg-slate-900">
                      {habit.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/60">Frequency</label>

                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <Sparkles className="h-4 w-4 text-indigo-300" />
                  <span className="text-sm text-white/70">Run all month</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/60">Reminder time</label>

                <div className="flex gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <Clock className="h-4 w-4 text-white/40" />
                    <span className="text-sm text-white/60">Time</span>
                  </div>

                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-white outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || success || !habitId}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {success ? (
                  <>
                    <Check className="h-4 w-4" />
                    Saved
                  </>
                ) : submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderDto[]>([]);
  const [manageableHabits, setManageableHabits] = useState<ReminderHabitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "muted">("all");

  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const hasFetched = useRef(false);

  const loadReminderData = useCallback(async () => {
    if (!currentUserId) {
      setError("Could not determine current user.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await fetchMyReminders();
      setReminders(data);

      const teams = await fetchTeams();
      const creatorTeams = teams.filter((team) => team.creatorId === currentUserId);

      const habitsByTeam = await Promise.all(
        creatorTeams.map(async (team) => {
          const habits = await fetchTeamHabits(team.habitTeamId);

          return habits.map((habit) => ({
            id: habit.habitId,
            name: habit.name,
            teamId: habit.habitTeamId,
            reminderTime: habit.reminderTime ?? null,
          }));
        })
      );

      setManageableHabits(habitsByTeam.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reminders.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    void loadReminderData();
  }, [loadReminderData]);

  const handleToggle = async (habitId: string, enabled: boolean) => {
    await apiFetch(`/api/habits/${habitId}/my-reminder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });

    setReminders((prev) =>
      prev.map((reminder) =>
        reminder.habitId === habitId ? { ...reminder, enabled } : reminder
      )
    );
  };

  const handleSetReminder = async (habitId: string, time: string) => {
    await apiFetch(`/api/habits/${habitId}/reminder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderTime: time }),
    });

    await loadReminderData();
  };

  const filtered = useMemo(() => {
    if (filter === "active") return reminders.filter((reminder) => reminder.enabled);
    if (filter === "muted") return reminders.filter((reminder) => !reminder.enabled);
    return reminders;
  }, [reminders, filter]);

  const habitOptions = useMemo(
    () => manageableHabits.map((habit) => ({ id: habit.id, name: habit.name })),
    [manageableHabits]
  );

  const canSetReminder = habitOptions.length > 0;

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "muted", label: "Muted" },
  ];
  return (
    <main className="min-h-screen overflow-hidden bg-[#07090F] px-4 py-6 text-white sm:px-6 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.10),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative mx-auto max-w-4xl rounded-[36px] border border-white/10 bg-black/35 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5 md:rounded-[42px] md:p-7"
      >
        <div className="mb-6 border-b border-white/10 pb-5">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mt-6 space-y-5"
        >
          {!loading && !error && reminders.length > 0 && (
            <motion.div variants={itemVariants}>
              <StatsStrip reminders={reminders} />
            </motion.div>
          )}

          <motion.div variants={itemVariants}>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle icon={<Bell className="h-5 w-5" />} title="Your Reminders" />

              {canSetReminder && (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Set Reminder
                  <ChevronRight className="h-3 w-3 opacity-60" />
                </button>
              )}
            </div>

            <Card className="min-h-[340px]">
              {!loading && !error && reminders.length > 0 && (
                <div className="mb-4 flex gap-2">
                  {filters.map((filterOption) => (
                    <button
                      key={filterOption.key}
                      type="button"
                      onClick={() => setFilter(filterOption.key)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                        filter === filterOption.key
                          ? "bg-indigo-500/20 text-indigo-300"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                  <p className="text-sm text-white/50">Loading reminders…</p>
                </div>
              ) : error ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
                  <AlertCircle className="h-6 w-6 text-rose-400/70" />
                  <p className="text-sm text-rose-300/80">{error}</p>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState canSetReminder={canSetReminder} />
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  <AnimatePresence>
                    {filtered.map((reminder) => (
                      <ReminderCard
                        key={reminder.reminderId}
                        reminder={reminder}
                        onToggle={handleToggle}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      <SetReminderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        habits={habitOptions}
        onSubmit={handleSetReminder}
      />
    </main>
  );
}