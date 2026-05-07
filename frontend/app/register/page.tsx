"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "../auxiliary/apiFetch";

const formVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch<{ token: string; email: string; username: string; userId: string; sessionId: string }>(
        "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            username,
          }),
        }
      );

      localStorage.setItem("token", data.token);
      localStorage.setItem("sessionId", data.sessionId);
      localStorage.setItem("user", JSON.stringify({
        userId: data.userId,
        username: data.username,
        email: data.email,
      }));

      router.push("/dashboard");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07090F] px-4 py-6 text-white sm:px-6 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.10),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[36px] border border-white/10 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:grid-cols-2">
        <section className="relative hidden overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.45),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" />

          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-black shadow-lg">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium uppercase tracking-[0.18em] text-white/85">
                  HabitHub
                </span>
              </div>
            </div>

            <div className="max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  Start your journey
                </div>

                <h1 className="text-4xl font-semibold leading-tight text-white xl:text-5xl">
                  Start strong.
                  <br />
                  Stay consistent.
                </h1>

                <p className="mt-5 max-w-md text-base leading-7 text-white/65">
                  Create your HabitHub account and begin building routines that last
                  with structure, motivation, and team support.
                </p>

                <div className="mt-8 grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                      Shared accountability
                    </p>
                    <p className="mt-2 text-sm text-white/80">
                      Join teams, track habits, and stay motivated together.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                      Focused progress
                    </p>
                    <p className="mt-2 text-sm text-white/80">
                      Build long-term consistency through goals, reminders, and streaks.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="text-sm text-white/35">
              HabitHub — collaborative habit tracking
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-5 sm:p-8 lg:p-10 xl:p-14">
          <motion.div
            variants={formVariants}
            initial="hidden"
            animate="show"
            className="w-full max-w-md"
          >
            <motion.div variants={itemVariants} className="mb-6 lg:hidden">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-black shadow-lg">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium uppercase tracking-[0.18em] text-white/85">
                  HabitHub
                </span>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"
            >
              <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">
                  Create account
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  Join HabitHub
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Start tracking your goals, habits, and team progress in one place.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <motion.div variants={itemVariants}>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-sm font-medium text-white/70"
                  >
                    Username
                  </label>

                  <div className="group flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 transition focus-within:border-emerald-400/40">
                    <User className="h-5 w-5 text-white/35" />
                    <input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUserName(e.target.value)}
                      required
                      className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-white/30"
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-white/70"
                  >
                    Email
                  </label>

                  <div className="group flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 transition focus-within:border-emerald-400/40">
                    <Mail className="h-5 w-5 text-white/35" />
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-white/30"
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-white/70"
                  >
                    Password
                  </label>

                  <div className="group flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 transition focus-within:border-emerald-400/40">
                    <Lock className="h-5 w-5 text-white/35" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-white/45 transition hover:text-white/80"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-medium text-white/70"
                  >
                    Confirm Password
                  </label>

                  <div className="group flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 transition focus-within:border-emerald-400/40">
                    <Lock className="h-5 w-5 text-white/35" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-white/30"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((prev) => !prev)
                      }
                      className="text-white/45 transition hover:text-white/80"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </motion.div>

                <AnimateError error={error} />

                <motion.div variants={itemVariants}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3.5 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <UserPlus className="h-4 w-4" />
                    {loading ? "Creating account..." : "Create account"}
                  </button>
                </motion.div>
              </form>

              <motion.p
                variants={itemVariants}
                className="mt-6 text-center text-sm text-white/60"
              >
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-white transition hover:text-emerald-300"
                >
                  Log in
                </Link>
              </motion.p>
            </motion.div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

function AnimateError({ error }: { error: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{
        opacity: error ? 1 : 0,
        height: error ? "auto" : 0,
      }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}
    </motion.div>
  );
}