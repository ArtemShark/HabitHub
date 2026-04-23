"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Link from "next/link";
import {
  Bell,
  Clock3,
  Settings,
  Pencil,
  Archive,
  Trash2,
  Flame,
  CheckCircle2,
  CalendarDays,
  Target,
  X,
  ListTodo,
} from "lucide-react";
import { Habit, HabitFormData, HabitResponseDto, UpdateHabitRequestDto, HabitStatus, HabitType } from "../dto/Habit";
import { mapHabit } from "../auxiliary/mapHabit";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getCurrentUserId(): string | null {
  const token = getToken();
  if (!token) return null;

  const payload = parseJwt(token);
  if (!payload) return null;

  const keys = [
    "nameid",
    "sub",
    "userId",
    "userid",
    "id",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  ];

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;

    if (response.status === 401) {
      message = "Unauthorized. Please log in again.";
    }

    try {
      const errorData = await response.json();
      message = errorData?.message || errorData?.title || message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {}
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

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

function NavButton({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -2, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={[
          "group relative overflow-hidden rounded-2xl border px-5 py-2.5 text-sm font-medium backdrop-blur-md transition md:text-base",
          active
            ? "border-emerald-400/70 bg-emerald-400/10 text-white shadow-[0_0_24px_rgba(16,185,129,0.18)]"
            : "border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
        ].join(" ")}
      >
        <span className="relative z-10">{label}</span>
        {active && (
          <span className="absolute inset-x-4 bottom-1 h-[2px] rounded-full bg-emerald-400" />
        )}
      </motion.div>
    </Link>
  );
}

function IconButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -2, scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10 hover:text-white md:h-12 md:w-12"
      >
        {children}
      </motion.div>
    </Link>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_35%)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-white/90">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white md:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-2 text-white/60">
        {icon}
        <span className="text-xs uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function HabitFormModal({
  open,
  initialData,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initialData: HabitFormData;
  onClose: () => void;
  onSubmit: (data: HabitFormData) => void;
}) {
  const [form, setForm] = useState<HabitFormData>(initialData);

  React.useEffect(() => {
    setForm(initialData);
  }, [initialData]);

  const isValueType = form.type === "value";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    setForm(initialData);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2"
          >
            <div className="rounded-[30px] border border-white/10 bg-[#0B1018]/95 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Edit Habit</h3>
                  <p className="mt-1 text-sm text-white/50">
                    Update the habit details below.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm text-white/65">Habit Name</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/65">Habit Type</label>
                    <select
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                    >
                      <option value="binary" className="bg-[#0B1018]">Binary</option>
                      <option value="value" className="bg-[#0B1018]">Value</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/65">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={form.endDate}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                    />
                  </div>

                  {isValueType && (
                    <>
                      <div>
                        <label className="mb-2 block text-sm text-white/65">Goal</label>
                        <input
                          type="number"
                          name="goal"
                          value={form.goal}
                          onChange={handleChange}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-white/65">Unit</label>
                        <input
                          name="unit"
                          value={form.unit}
                          onChange={handleChange}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function HabitsPage() {
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

  const handleSubmitHabit = async (data: HabitFormData) => {
    if (!editingHabitId) return;

    try {
      setError("");
      setSuccess("");

      const payload: UpdateHabitRequestDto = {
        name: data.name.trim(),
        habitType: data.type,
        goal: data.type === "value" && data.goal ? data.goal : null,
        unit: data.type === "value" ? data.unit.trim() || null : null,
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
        <header className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/70">
                HabitHub
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Habits
              </h1>
              <p className="mt-2 text-sm text-white/50">
                Manage, update, archive, and track all team habits in one place.
              </p>
            </div>

            <nav className="flex flex-wrap gap-3">
              <NavButton href="/dashboard" label="Home" />
              <NavButton href="/teams" label="Teams" />
              <NavButton href="/habits" label="Habits" active />
              <NavButton href="/progress" label="Progress" />
            </nav>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
            <IconButton href="/notifications">
              <Bell className="h-5 w-5" />
            </IconButton>
            <IconButton href="/sessions">
              <Clock3 className="h-5 w-5" />
            </IconButton>
            <IconButton href="/settings">
              <Settings className="h-5 w-5" />
            </IconButton>
          </div>
        </header>

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
                <StatPill icon={<CheckCircle2 className="h-4 w-4" />} label="Active" value={activeCount} />
                <StatPill icon={<Archive className="h-4 w-4" />} label="Archived" value={archivedCount} />
                <StatPill icon={<ListTodo className="h-4 w-4" />} label="Total" value={habits.length} />
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