"use client";

import Link from "next/link";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

type Session = {
  id: number;
  device: string;
  location: string;
  current?: boolean;
};

type Goal = {
  id: number;
  title: string;
  done: boolean;
};

const sessions: Session[] = [
  { id: 1, device: "Windows Laptop", location: "Warsaw, Poland", current: true },
  { id: 2, device: "iPhone", location: "Warsaw, Poland" },
  { id: 3, device: "Tablet", location: "Krakow, Poland" },
];

const goals: Goal[] = [
  { id: 1, title: "Drink 2L of water", done: true },
  { id: 2, title: "Read 20 pages", done: false },
  { id: 3, title: "Walk 8k steps", done: false },
];

const progressData = [
  { value: 82, color: "#4F46E5", label: "Habits" },
  { value: 68, color: "#F43F5E", label: "Team Progress" },
  { value: 54, color: "#22D3EE", label: "Consistency" },
  { value: 41, color: "#FBBF24", label: "Goals" },
];

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

function MultiRingProgress() {
  const size = 260;
  const center = size / 2;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="absolute h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative"
      >
        {progressData.map((ring, index) => {
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
        <p className="mt-1 text-3xl font-semibold text-white md:text-4xl">82%</p>
        <p className="mt-1 text-sm text-white/55">Strong momentum</p>
      </div>
    </div>
  );
}

export default function HomePage() {
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
            <IconButton href="/notifications">
              <Bell className="h-5 w-5" />
            </IconButton>
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
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    whileHover={{ y: -3, scale: 1.01 }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-white">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/8">
                            <SessionIcon device={session.device} />
                          </span>
                          <p className="font-medium">{session.device}</p>
                        </div>

                        <p className="text-sm text-white/55">{session.location}</p>
                      </div>

                      <ChevronRight className="mt-1 h-4 w-4 text-white/35" />
                    </div>

                    {session.current && (
                      <span className="mt-4 inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                        Current session
                      </span>
                    )}
                  </motion.div>
                ))}
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
                <MultiRingProgress />

                <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="space-y-4">
                {goals.map((goal) => (
                  <motion.label
                    key={goal.id}
                    whileHover={{ y: -2, scale: 1.01 }}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={goal.done}
                      className="mt-1 h-4 w-4 rounded accent-emerald-400"
                    />

                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          goal.done ? "text-white/45 line-through" : "text-white/90"
                        }`}
                      >
                        {goal.title}
                      </p>

                      <p className="mt-1 text-sm text-white/45">
                        {goal.done ? "Completed today" : "Still in progress"}
                      </p>
                    </div>
                  </motion.label>
                ))}

                <motion.button
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-2 w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/75 transition hover:border-white/25 hover:bg-white/8 hover:text-white"
                >
                  + Add goal
                </motion.button>
              </div>
            </Card>
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