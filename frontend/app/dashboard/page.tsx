"use client";

import Link from "next/link";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  Clock3,
  Settings,
  Laptop,
  Smartphone,
  Tablet,
  ChevronRight,
  Activity,
  Target,
  ShieldCheck,
  User,
  LogOut,
  Loader2,
  AlertCircle,
} from "lucide-react";
import NotificationDropdown from "../notifications/NotificationDropdown";
import { Habit, HabitEntryRequest, HabitEntryResponse, HabitResponseDto } from "../dto/Habit";
import { mapHabit } from "../auxiliary/mapHabit";
import { apiFetch } from "../auxiliary/apiFetch";
import { getCurrentUserId } from "../auxiliary/getCurrentUserId";
import { Session, SessionState } from "../dto/Session";
import { set } from "zod";
import { get } from "http";


async function fetchHabitsForMember(memberId: string): Promise<Habit[]> {
  const dtos = await apiFetch<HabitResponseDto[]>(`/api/habits?memberId=${memberId}`, {
    method: "GET",
  });
  return dtos.map(mapHabit);
}

async function fetchEntriesForHabit(habitId: string): Promise<HabitEntryResponse[]> {
  return apiFetch<HabitEntryResponse[]>(`/api/habits/${habitId}/entries`, {
    method: "GET",
  });
}

async function fetchSessionsForMember(memberId: string): Promise<Session[]> {
  return apiFetch<Session[]>(`/api/sessions`, {
    method: "GET",
  });
}

type ProgressRing = {
  value: number;
  color: string;
  label: string;
};

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] } },
};

function NavButton({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
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
        {active && <span className="absolute inset-x-4 bottom-1 h-[2px] rounded-full bg-emerald-400" />}
      </motion.div>
    </Link>
  );
}

function IconButton({ href, children }: { href: string; children: React.ReactNode }) {
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

function SettingsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileHover={{ y: -2, scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((prev) => !prev)}
        className={[
          "flex h-11 w-11 items-center justify-center rounded-2xl border backdrop-blur-md transition md:h-12 md:w-12",
          open
            ? "border-white/25 bg-white/10 text-white"
            : "border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
        ].join(" ")}
      >
        <Settings className="h-5 w-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 top-14 z-50 w-52 overflow-hidden rounded-[20px] border border-white/10 bg-[#0D1117]/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          >

            <div className="border-b border-white/8 px-4 py-3">
              <p className="text-xs text-white/40">Signed in as</p>
              <p className="mt-0.5 truncate text-sm font-medium text-white">
                {typeof window !== "undefined"
                  ? JSON.parse(localStorage.getItem("user") || "{}").username ?? "User"
                  : "User"}
              </p>
            </div>

            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-white/75 transition hover:bg-white/6 hover:text-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                <User className="h-3.5 w-3.5" />
              </span>
              My Profile
            </Link>

            <div className="mx-4 border-t border-white/8" />

            <button
  onClick={() => {
    setOpen(false);
    window.location.href = "/logout";
  }}
  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-rose-400/80 transition hover:bg-rose-500/8 hover:text-rose-400"
>
  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
    <LogOut className="h-3.5 w-3.5" />
  </span>
  Log out
</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  align = "left",
}: {
  icon: React.ReactNode;
  title: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={[
        "mb-4 flex items-center gap-2",
        align === "center" ? "justify-center text-center" : "justify-start",
      ].join(" ")}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-white/90">
        {icon}
      </span>
      <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
        {title}
      </h2>
    </div>
  );
}

function SessionIcon({ device }: { device: string }) {
  const name = device.toLowerCase();

  if (name.includes("iphone") || name.includes("phone")) {
    return <Smartphone className="h-4 w-4" />;
  }

  if (name.includes("tablet")) {
    return <Tablet className="h-4 w-4" />;
  }

  return <Laptop className="h-4 w-4" />;
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
        "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_35%)] before:pointer-events-none",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function MultiRingProgress({ data, overall }: { data: ProgressRing[]; overall: number }) {
  const size = 260;
  const center = size / 2;

  const overallLabel =
    overall >= 75 ? "Strong momentum" :
    overall >= 50 ? "Good progress" :
    overall >= 25 ? "Getting started" :
    "No data yet";

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="absolute h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative"
      >
        {data.map((ring, index) => {
          const radius = 84 - index * 18;
          const circumference = 2 * Math.PI * radius;
          const dashOffset = circumference * (1 - ring.value / 100);

          return (
            <g key={ring.label}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="12"
              />

              <motion.circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 1.2, delay: index * 0.12, ease: [0.25, 0.1, 0.25, 1] }}
                transform={`rotate(-90 ${center} ${center})`}
              />
            </g>
          );
        })}
      </svg>

      <div className="absolute text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Overall</p>
        <p className="mt-1 text-3xl font-semibold text-white md:text-4xl">{overall}%</p>
        <p className="mt-1 text-sm text-white/55">{overallLabel}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [habitsError, setHabitsError] = useState("");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [allEntries, setAllEntries] = useState<HabitEntryResponse[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<(typeof todaysGoals)[number] | null>(null);
  const [logValue, setLogValue] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logStatus, setLogStatus] = useState<"Logged" | "Skipped">("Logged");
  const [sessions, setSessions] = useState<Session[]>([]);

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    async function loadHabits() {
      if (!currentUserId) {
        setHabitsError("Could not determine current user.");
        setHabitsLoading(false);
        return;
      }

      try {
        if (!hasFetchedRef.current) {
          setHabitsLoading(true);
        }
        setHabitsError("");
        const data = await fetchHabitsForMember(currentUserId);
        setHabits(data);
        
        const today = new Date().toISOString().split("T")[0];

        const entriesPerHabit = await Promise.all(
          data.map(async (habit) => {
            const [todayEntries, allHabitEntries] = await Promise.all([
              apiFetch<HabitEntryResponse[]>(
                `/api/habits/${habit.id}/entries?date=${today}`,
                { method: "GET" }
              ),
              fetchEntriesForHabit(habit.id),
            ]);

            return { habitId: habit.id, todayEntries, allHabitEntries };
          })
        );

        const nextCompletedIds = new Set<string>();
        const collectedEntries: HabitEntryResponse[] = [];

        for (const { habitId, todayEntries, allHabitEntries } of entriesPerHabit) {
          if (todayEntries.some((entry) => entry.status === "Logged")) {
            nextCompletedIds.add(habitId);
          }
          collectedEntries.push(...allHabitEntries);
        }

        setCompletedIds(nextCompletedIds);
        setAllEntries(collectedEntries);

        hasFetchedRef.current = true;
      } catch (err) {
        setHabitsError(err instanceof Error ? err.message : "Failed to load habits.");
      } finally {
        setHabitsLoading(false);
      }
    }

    async function loadSessions() {
      console.log("Loading sessions");
      if(!currentUserId) {
        return;
      }
      try {
        const data = await fetchSessionsForMember(currentUserId);
        console.log(data);
        setSessions(data);
      } catch (err) {
        console.error("Failed to load sessions.", err);
      }

    }

    void loadHabits();
    void loadSessions();

    const interval = setInterval(() => {
      void loadHabits();
    }, 30_000);

    return () => clearInterval(interval);
  }, [currentUserId]);

  const todaysGoals = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return habits.filter((habit) => {
      if (habit.status !== "active") return false;
      if (habit.endDate) {
        const end = new Date(habit.endDate);
        end.setHours(23, 59, 59, 999);
        if (end < now) return false;
      }
      return true;
    });
  }, [habits]);

  const progressData = useMemo<ProgressRing[]>(() => {
    const goalCount = todaysGoals.length;
    const completedCount = todaysGoals.filter((g) => completedIds.has(g.id)).length;
    const todayPercent = goalCount > 0
      ? Math.round((completedCount / goalCount) * 100)
      : 0;

    const totalEntries = allEntries.length;
    const loggedCount = allEntries.filter(
      (e) => e.status === "Logged" || e.status === 0
    ).length;
    const completionPercent = totalEntries > 0
      ? Math.round((loggedCount / totalEntries) * 100)
      : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentlyLoggedHabitIds = new Set(
      allEntries
        .filter(
          (e) =>
            (e.status === "Logged" || e.status === 0) &&
            new Date(e.date) >= sevenDaysAgo
        )
        .map((e) => e.habitId)
    );

    const activeHabits = habits.filter((h) => h.status === "active");
    const coveredCount = activeHabits.filter((h) =>
      recentlyLoggedHabitIds.has(h.id)
    ).length;
    const coveragePercent = activeHabits.length > 0
      ? Math.round((coveredCount / activeHabits.length) * 100)
      : 0;

    return [
      { value: todayPercent, color: "#4F46E5", label: "Today's Progress" },
      { value: completionPercent, color: "#F43F5E", label: "Completion Rate" },
      { value: coveragePercent, color: "#22D3EE", label: "Habit Coverage" },
    ];
  }, [habits, allEntries, todaysGoals, completedIds]);

  const overallPercent = useMemo(() => {
    if (progressData.length === 0) return 0;
    const sum = progressData.reduce((acc, r) => acc + r.value, 0);
    return Math.round(sum / progressData.length);
  }, [progressData]);

  const toggleGoal = (habitId: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(habitId)) {
        next.delete(habitId);
      } else {
        next.add(habitId);
      }
      return next;
    });
  };

  const openLogModal = (habit: (typeof todaysGoals)[number]) => {
    setSelectedHabit(habit);
    setLogValue("");
    setLogNote("");
    setLogStatus("Logged");
  };

  const closeLogModal = () => {
    setSelectedHabit(null);
    setLogValue("");
    setLogNote("");
    setLogStatus("Logged");
  };

  const submitHabitLog = async () => {
    if (!selectedHabit) return;

    const body =
      selectedHabit.type === "quantitative"
        ? {
            status: logStatus,
            value: logValue === "" ? null : Number(logValue),
            notes: logNote,
          }
        : {
            status: logStatus,
            notes: logNote,
          };

    try {
      await apiFetch<HabitEntryResponse>(`/api/habits/${selectedHabit.id}/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (logStatus === "Logged") {
        setCompletedIds((prev) => new Set(prev).add(selectedHabit.id));
      } else {
        setCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(selectedHabit.id);
          return next;
        });
      }

      closeLogModal();
    } catch (error) {
      console.error("Error logging habit:", error);
    }
  };

  async function terminateSession(sessionId: string) {
    try {
      await apiFetch<void>(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });

      const currentSessionId = localStorage.getItem("sessionId");

      if (sessionId === currentSessionId) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("sessionId");
        window.location.href = "/login";
        return;
      }

      setSessions((prev) =>
        prev.filter((session) => session.sessionId !== sessionId)
      );
    } catch (err) {
      console.error(
        err instanceof Error ? err.message : "Failed to terminate session"
      );
    }
  }

  function formatDevice(device?: string) {
    if (!device) return "Unknown Device";

    const d = device.toLowerCase();

    let browser = "Browser";
    let os = "Device";

    if (d.includes("chrome")) browser = "Chrome";
    else if (d.includes("firefox")) browser = "Firefox";
    else if (d.includes("safari")) browser = "Safari";
    else if (d.includes("edge")) browser = "Edge";

    if (d.includes("windows")) os = "Windows";
    else if (d.includes("iphone")) os = "iPhone";
    else if (d.includes("android")) os = "Android";
    else if (d.includes("mac")) os = "macOS";
    else if (d.includes("linux")) os = "Linux";

    return `${browser} on ${os}`;
  }

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
                HabitHub Dashboard
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Welcome back
              </h1>
            </div>

            <nav className="flex flex-wrap gap-3">
              <NavButton href="/home" label="Home" active />
              <NavButton href="/teams" label="Teams" />
              <NavButton href="/habits" label="Habits" />
              <NavButton href="/progress" label="Progress" />
            </nav>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
            <NotificationDropdown/>
            <IconButton href="/sessions">
              <Clock3 className="h-5 w-5" />
            </IconButton>
            <SettingsDropdown />
          </div>
        </header>

        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_1.5fr_1.05fr]"
        >
          <motion.div variants={itemVariants}>
            <SectionTitle
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Active Sessions"
            />

            <Card className="min-h-[320px]">
              <div className="space-y-4">
                <AnimatePresence>
                {sessions.map((session) => (
                  <motion.div
                    key={session.sessionId}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      x: 40,
                      scale: 0.92,
                      transition: { duration: 0.22 }
                    }}
                    transition={{
                      duration: 0.25,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                    whileHover={{ y: -3, scale: 1.01 }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-white">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/8">
                            <SessionIcon device={session.device ?? "Unknown Device"} />
                          </span>
                          <p className="font-medium">
                            {formatDevice(session.device)}
                          </p>
                        </div>

                      </div>

                    </div>

                    {session.sessionId === localStorage.getItem("sessionId") && (
                      <span className="mt-4 inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                        Current session
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void terminateSession(session.sessionId)}
                      className="mt-3 ml-4 cursor-pointer rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-300"
                    >
                      Terminate session
                    </button>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <SectionTitle
              icon={<Activity className="h-5 w-5" />}
              title="Progress Overview"
              align="center"
            />

            <Card className="min-h-[320px]">
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <MultiRingProgress data={progressData} overall={overallPercent} />

                <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {progressData.map((item) => (
                    <motion.div
                      key={item.label}
                      whileHover={{ y: -2 }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium text-white/90">
                          {item.label}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white/8">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.value}%` }}
                          transition={{ duration: 1, delay: 0.25 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                      </div>

                      <p className="mt-2 text-sm text-white/55">{item.value}% complete</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <SectionTitle
              icon={<Target className="h-5 w-5" />}
              title="Today's Goals"
              align="center"
            />

            <Card className="min-h-[320px]">
              {habitsLoading ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                  <p className="text-sm text-white/50">Loading habits…</p>
                </div>
              ) : habitsError ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                  <AlertCircle className="h-6 w-6 text-rose-400/70" />
                  <p className="text-sm text-rose-300/80">{habitsError}</p>
                </div>
              ) : todaysGoals.length === 0 ? (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                  <Target className="h-6 w-6 text-white/30" />
                  <p className="text-sm text-white/50">No goals for today.</p>
                  <p className="text-xs text-white/35">
                    Create habits in the Habits tab and they will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todaysGoals.map((habit) => {
                    const done = completedIds.has(habit.id);

                    return (
                      <motion.div
                        key={habit.id}
                        whileHover={{ y: -2, scale: 1.01 }}
                        onClick={() => openLogModal(habit)}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={(e) => {
                            e.stopPropagation();
                            openLogModal(habit);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 rounded accent-emerald-400"
                        />

                        <div className="flex-1">
                          <p
                            className={`font-medium ${
                              done ? "text-white/45 line-through" : "text-white/90"
                            }`}
                          >
                            {habit.name}
                          </p>

                          <p className="mt-1 text-sm text-white/45">
                            {done
                              ? "Completed today"
                              : habit.type === "quantitative" && habit.goal
                                ? `Target: ${habit.goal}${habit.unit ? ` ${habit.unit}` : ""}`
                                : "Still in progress"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                
              )}
            </Card>
            <AnimatePresence>
              {selectedHabit && (
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeLogModal}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 16 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl"
                  >
                    <div className="mb-5 flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          Log habit
                        </h3>
                        <p className="mt-1 text-sm text-white/50">
                          {selectedHabit.name}
                        </p>
                      </div>

                      <button
                        onClick={closeLogModal}
                        className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm text-white/70">Status</label>
                        <select
                          value={logStatus}
                          onChange={(e) => setLogStatus(e.target.value as "Logged" | "Skipped")}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                        >
                          <option value="Logged" className="bg-slate-900">
                            Logged
                          </option>
                          <option value="Skipped" className="bg-slate-900">
                            Skipped
                          </option>
                        </select>
                      </div>

                      {selectedHabit.type === "quantitative" && (
                        <div>
                          <label className="mb-2 block text-sm text-white/70">
                            Value {selectedHabit.unit ? `(${selectedHabit.unit})` : ""}
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={logValue}
                            onChange={(e) => setLogValue(e.target.value)}
                            placeholder="Enter value"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="mb-2 block text-sm text-white/70">Note</label>
                        <textarea
                          value={logNote}
                          onChange={(e) => setLogNote(e.target.value)}
                          placeholder="Optional note"
                          rows={4}
                          className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={closeLogModal}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80 transition hover:bg-white/10"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={submitHabitLog}
                        className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 font-medium text-white transition hover:bg-emerald-400"
                      >
                        Save log
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white/50">Reminders</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">2 pending reminders</h3>
                  <p className="mt-2 text-sm text-white/50">
                    Stay on track with your daily habit check-ins.
                  </p>
                </div>

                <div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-300">
                  <Bell className="h-6 w-6" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white/50">Quick Access</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">Settings & account</h3>
                  <p className="mt-2 text-sm text-white/50">
                    Manage profile, privacy, notifications, and sessions.
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300">
                  <Settings className="h-6 w-6" />
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.section>
      </motion.div>
    </main>
  );
}