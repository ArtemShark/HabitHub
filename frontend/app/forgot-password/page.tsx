"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
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

type ForgotPasswordResponse = {
  message?: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch<ForgotPasswordResponse>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            newPassword,
            confirmPassword,
          }),
        }
      );

      setSuccess(
        response.message ?? "Password reset successfully. Please log in with your new password."
      );
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07090F] px-4 py-6 text-white sm:px-6 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(79,70,229,0.12),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
        <motion.section
          variants={formVariants}
          initial="hidden"
          animate="show"
          className="w-full rounded-[36px] border border-white/10 bg-black/35 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8 md:rounded-[42px] md:p-10"
        >
          <motion.div variants={itemVariants}>
            <Link
              href="/login"
              className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <KeyRound className="h-6 w-6" />
            </div>

            <h1 className="text-3xl font-semibold text-white">Reset password</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/55">
              Enter your account email and choose a new password. After resetting,
              all active sessions for this account will be invalidated.
            </p>
          </motion.div>

          <motion.form variants={formVariants} onSubmit={handleSubmit} className="space-y-5">
            <motion.div variants={itemVariants}>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-white/70">
                Email
              </label>
              <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 transition focus-within:border-emerald-400/40">
                <Mail className="h-5 w-5 text-white/35" />
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-white/30"
                />
              </div>
            </motion.div>

            <PasswordField
              id="new-password"
              label="New password"
              value={newPassword}
              show={showNewPassword}
              onToggle={() => setShowNewPassword((value) => !value)}
              onChange={setNewPassword}
            />

            <PasswordField
              id="confirm-password"
              label="Confirm password"
              value={confirmPassword}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((value) => !value)}
              onChange={setConfirmPassword}
            />

            <AnimatedMessage message={error} type="error" />
            <AnimatedMessage message={success} type="success" />

            <motion.div variants={itemVariants}>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3.5 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </motion.div>

            {success && (
              <motion.div variants={itemVariants}>
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  Go to login
                </button>
              </motion.div>
            )}
          </motion.form>
        </motion.section>
      </div>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  show,
  onToggle,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <motion.div variants={itemVariants}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-white/70">
        {label}
      </label>
      <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 transition focus-within:border-emerald-400/40">
        <Lock className="h-5 w-5 text-white/35" />
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={6}
          className="w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="text-white/45 transition hover:text-white/80"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </motion.div>
  );
}

function AnimatedMessage({ message, type }: { message: string; type: "error" | "success" }) {
  const classes =
    type === "error"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-300"
      : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: message ? 1 : 0, height: message ? "auto" : 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      {message && <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>{message}</div>}
    </motion.div>
  );
}
