"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Link from "next/link";
import {
  Bell,
  Clock3,
  Settings,
  Plus,
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

type HabitStatus = "active" | "archived";
type HabitType = "binary" | "value";

type Habit = {
  id: number;
  name: string;
  description: string;
  type: HabitType;
  goal?: number;
  unit?: string;
  endDate?: string;
  status: HabitStatus;
  streak: number;
  progress: number;
};

type HabitFormData = {
  name: string;
  description: string;
  type: HabitType;
  goal: string;
  unit: string;
  endDate: string;
};

const initialHabits: Habit[] = [
  {
    id: 1,
    name: "Drink Water",
    description: "Stay hydrated throughout the day",
    type: "value",
    goal: 2,
    unit: "liters",
    endDate: "2026-04-30",
    status: "active",
    streak: 6,
    progress: 78,
  },
  {
    id: 2,
    name: "Read",
    description: "Read at least 20 pages",
    type: "value",
    goal: 20,
    unit: "pages",
    endDate: "2026-05-10",
    status: "active",
    streak: 12,
    progress: 64,
  },
  {
    id: 3,
    name: "Morning Stretching",
    description: "Quick flexibility routine",
    type: "binary",
    status: "active",
    streak: 9,
    progress: 88,
  },
  {
    id: 4,
    name: "10k Steps",
    description: "Daily movement goal",
    type: "value",
    goal: 10000,
    unit: "steps",
    endDate: "2026-03-28",
    status: "archived",
    streak: 21,
    progress: 100,
  },
];

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

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-xs text-white/50">
        <span>Progress</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500"
        />
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
  mode,
  initialData,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "add" | "edit";
  initialData: HabitFormData;
  onClose: () => void;
  onSubmit: (data: HabitFormData) => void;
}) {
  const [form, setForm] = useState<HabitFormData>(initialData);

  const isValueType = form.type === "value";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
    setForm(initialData);
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
                  <h3 className="text-2xl font-semibold text-white">
                    {mode === "add" ? "Add New Habit" : "Edit Habit"}
                  </h3>
                  <p className="mt-1 text-sm text-white/50">
                    Configure the habit details below.
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
                      placeholder="e.g. Drink Water"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm text-white/65">Description</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Short habit description"
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
                      <option value="binary" className="bg-[#0B1018]">
                        Binary
                      </option>
                      <option value="value" className="bg-[#0B1018]">
                        Value
                      </option>
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
                          placeholder="e.g. 2"
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-white/65">Unit</label>
                        <input
                          name="unit"
                          value={form.unit}
                          onChange={handleChange}
                          placeholder="e.g. liters, pages, km"
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/40"
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
                    {mode === "add" ? "Create Habit" : "Save Changes"}
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
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [activeTab, setActiveTab] = useState<HabitStatus>("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);

  const emptyForm: HabitFormData = {
    name: "",
    description: "",
    type: "binary",
    goal: "",
    unit: "",
    endDate: "",
  };

  const editingHabit = habits.find((habit) => habit.id === editingHabitId);

  const modalInitialData: HabitFormData =
    modalMode === "edit" && editingHabit
      ? {
          name: editingHabit.name,
          description: editingHabit.description,
          type: editingHabit.type,
          goal: editingHabit.goal?.toString() ?? "",
          unit: editingHabit.unit ?? "",
          endDate: editingHabit.endDate ?? "",
        }
      : emptyForm;

  const visibleHabits = useMemo(
    () => habits.filter((habit) => habit.status === activeTab),
    [habits, activeTab]
  );

  const activeCount = habits.filter((h) => h.status === "active").length;
  const archivedCount = habits.filter((h) => h.status === "archived").length;

  const openAddModal = () => {
    setModalMode("add");
    setEditingHabitId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (habitId: number) => {
    setModalMode("edit");
    setEditingHabitId(habitId);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHabitId(null);
  };

  const handleSubmitHabit = (data: HabitFormData) => {
    const mappedHabit: Omit<Habit, "id" | "status" | "streak" | "progress"> = {
      name: data.name.trim(),
      description: data.description.trim(),
      type: data.type,
      goal: data.type === "value" && data.goal ? Number(data.goal) : undefined,
      unit: data.type === "value" ? data.unit.trim() : undefined,
      endDate: data.endDate || undefined,
    };

    if (modalMode === "add") {
      const newHabit: Habit = {
        id: Date.now(),
        ...mappedHabit,
        status: "active",
        streak: 0,
        progress: 0,
      };

      setHabits((prev) => [newHabit, ...prev]);
    } else if (modalMode === "edit" && editingHabitId !== null) {
      setHabits((prev) =>
        prev.map((habit) =>
          habit.id === editingHabitId
            ? {
                ...habit,
                ...mappedHabit,
              }
            : habit
        )
      );
    }

    closeModal();
  };

  const handleArchiveHabit = (habitId: number) => {
    setHabits((prev) =>
      prev.map((habit) =>
        habit.id === habitId ? { ...habit, status: "archived" } : habit
      )
    );
  };

  const handleDeleteHabit = (habitId: number) => {
    setHabits((prev) => prev.filter((habit) => habit.id !== habitId));
  };

  const handleUnarchiveHabit = (habitId: number) => {
    setHabits((prev) =>
      prev.map((habit) =>
        habit.id === habitId ? { ...habit, status: "active" } : habit
      )
    );
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
                <StatPill
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Active"
                  value={activeCount}
                />
                <StatPill
                  icon={<Archive className="h-4 w-4" />}
                  label="Archived"
                  value={archivedCount}
                />
                <StatPill
                  icon={<ListTodo className="h-4 w-4" />}
                  label="Total"
                  value={habits.length}
                />
              </div>

              <button
                onClick={openAddModal}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01]"
              >
                <Plus className="h-4 w-4" />
                Add New Habit
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
                  {visibleHabits.length > 0 ? (
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
                              <h3 className="text-lg font-semibold text-white">
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

                            <p className="mt-2 text-sm text-white/55">
                              {habit.description || "No description provided."}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/65">
                              {habit.goal !== undefined && (
                                <span className="rounded-xl bg-white/5 px-3 py-2">
                                  Goal: {habit.goal} {habit.unit}
                                </span>
                              )}

                              {habit.endDate && (
                                <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                                  <CalendarDays className="h-4 w-4" />
                                  {habit.endDate}
                                </span>
                              )}

                              <span className="rounded-xl bg-white/5 px-3 py-2">
                                Streak: {habit.streak} days
                              </span>
                            </div>

                            <ProgressBar value={habit.progress} />
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
                                onClick={() => handleArchiveHabit(habit.id)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-2.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-400/15"
                              >
                                <Archive className="h-4 w-4" />
                                Archive
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUnarchiveHabit(habit.id)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/15"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Restore
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteHabit(habit.id)}
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
                      <p className="mt-2 text-sm text-white/45">
                        {activeTab === "active"
                          ? "Create a new habit to get started."
                          : "Archived habits will appear here."}
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
        mode={modalMode}
        initialData={modalInitialData}
        onClose={closeModal}
        onSubmit={handleSubmitHabit}
      />
    </main>
  );
}