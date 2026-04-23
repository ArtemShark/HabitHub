"use client";

import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  User,
  Mail,
  Pencil,
  Lock,
  Check,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { apiFetch, getToken } from "../auxiliary/apiFetch";
//import { apiFetch } from "../auxiliary/apiFetch";

type Toast = { id: number; message: string; type: "success" | "error" };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: [0.25, 0.1, 0.25, 1] },
  },
};

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
        "relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]",
        "p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl",
        "before:absolute before:inset-0 before:pointer-events-none",
        "before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.09),transparent_35%)]",
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
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-white/90">
        {icon}
      </span>
      <h2 className="text-xl font-semibold tracking-tight text-white">
        {title}
      </h2>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3.5">
      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <div className="flex items-center gap-2.5">
        <span className="text-white/50">{icon}</span>
        <p className="text-base font-medium text-white/90">{value}</p>
      </div>
    </div>
  );
}

function ToastBar({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      className={[
        "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-xl",
        toast.type === "success"
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "border-rose-400/25 bg-rose-400/10 text-rose-300",
      ].join(" ")}
    >
      {toast.type === "success" ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <X className="h-4 w-4 shrink-0" />
      )}
      {toast.message}
    </motion.div>
  );
}


function EditProfileModal({
  username,
  email,
  onClose,
  onSave,
}: {
  username: string;
  email: string;
  onClose: () => void;
  onSave: (u: string, e: string) => void;
}) {
  const [u, setU] = useState(username);
  const [e, setE] = useState(email);

  return (
    <ModalShell onClose={onClose} title="Edit Profile">
      <div className="space-y-4">
        <LabeledInput
          label="Username"
          value={u}
          onChange={setU}
          icon={<User className="h-4 w-4" />}
          placeholder="Your username"
        />
        <LabeledInput
          label="Email"
          value={e}
          onChange={setE}
          icon={<Mail className="h-4 w-4" />}
          placeholder="your@email.com"
          type="email"
        />
      </div>
      <ModalActions
        onCancel={onClose}
        onConfirm={() => onSave(u, e)}
        confirmLabel="Save changes"
      />
    </ModalShell>
  );
}


function ChangePasswordModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (current: string, next: string) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length >= 6 && next.length >= 6 && next === confirm;

  return (
    <ModalShell onClose={onClose} title="Change Password">
      <div className="space-y-4">
        <PasswordInput
          label="Current password"
          value={current}
          onChange={setCurrent}
          show={showCurrent}
          toggle={() => setShowCurrent((p) => !p)}
        />
        <PasswordInput
          label="New password"
          value={next}
          onChange={setNext}
          show={showNext}
          toggle={() => setShowNext((p) => !p)}
        />
        <div>
          <PasswordInput
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            show={showNext}
            toggle={() => setShowNext((p) => !p)}
            error={mismatch}
          />
          {mismatch && (
            <p className="mt-1.5 text-xs text-rose-400">Passwords don't match</p>
          )}
        </div>
      </div>
      <ModalActions
        onCancel={onClose}
        onConfirm={() => canSubmit && onSave(current, next)}
        confirmLabel="Update password"
        disabled={!canSubmit}
      />
    </ModalShell>
  );
}


function ModalShell({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0D1117]/95 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  icon,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition focus-within:border-white/25 focus-within:bg-white/8">
        <span className="text-white/45">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
        />
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  toggle,
  error = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggle: () => void;
  error?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </p>
      <div
        className={[
          "flex items-center gap-2.5 rounded-2xl border px-4 py-3 transition focus-within:bg-white/8",
          error
            ? "border-rose-400/40 bg-rose-400/5"
            : "border-white/10 bg-white/5 focus-within:border-white/25",
        ].join(" ")}
      >
        <span className="text-white/45">
          <Lock className="h-4 w-4" />
        </span>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
        />
        <button
          type="button"
          onClick={toggle}
          className="text-white/40 transition hover:text-white/70"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  disabled = false,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3">
      <button
        onClick={onCancel}
        className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/8 hover:text-white"
      >
        Cancel
      </button>
      <motion.button
        whileHover={disabled ? {} : { y: -1, scale: 1.01 }}
        whileTap={disabled ? {} : { scale: 0.98 }}
        onClick={onConfirm}
        disabled={disabled}
        className={[
          "flex-1 rounded-2xl py-2.5 text-sm font-medium transition",
          disabled
            ? "cursor-not-allowed border border-white/8 bg-white/5 text-white/30"
            : "border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15",
        ].join(" ")}
      >
        {confirmLabel}
      </motion.button>
    </div>
  );
}


function ActionButton({
  icon,
  label,
  description,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  accent: "indigo" | "emerald";
  onClick: () => void;
}) {
  const colors = {
    indigo: {
      wrap: "bg-indigo-500/10 text-indigo-300",
      hover: "hover:border-indigo-400/30 hover:bg-indigo-400/5",
    },
    emerald: {
      wrap: "bg-emerald-500/10 text-emerald-300",
      hover: "hover:border-emerald-400/30 hover:bg-emerald-400/5",
    },
  };

  return (
    <motion.button
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition",
        colors[accent].hover,
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
          colors[accent].wrap,
        ].join(" ")}
      >
        {icon}
      </span>
      <div>
        <p className="font-medium text-white/90">{label}</p>
        <p className="mt-0.5 text-sm text-white/45">{description}</p>
      </div>
    </motion.button>
  );
}


export default function ProfilePage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUsername(user.username ?? "");
    setEmail(user.email ?? "");
  }, []);

  const [modal, setModal] = useState<"edit" | "password" | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(message: string, type: "success" | "error") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }


  async function handleSaveProfile(u: string, e: string) {
    try {
      if (!e.includes("@")) {
        addToast("Invalid email format", "error");
        return;
      }
  
      await apiFetch<{ token: string; id: string; username: string }>(
        "/api/profile/info",
        {
          method: "PUT",
          body: JSON.stringify({
            username: u,
            email: e,
          }),
        }
      );

      setUsername(u);
      setEmail(e);

      const stored = JSON.parse(localStorage.getItem("user") || "{}");

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...stored,
          username: u,
          email: e,
        })
      );

      setModal(null);
      addToast("Profile updated successfully", "success");
    } catch (err: any) {
      console.error(err);
      addToast("Failed to update profile", "error");
    }
  }
  async function handleSavePassword(current: string, next: string) {
    try {
      await apiFetch<{ token: string; id: string;}>(
        "/api/profile/password",
        {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: current,
            newPassword:next,
          }),
        }
      );

      setModal(null);
      addToast("Password changed successfully", "success");
    } catch (err: any) {
  console.error(err);
  addToast(err.message || "Failed to change password", "error");
}
  }
  const initials = username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#07090F] px-4 py-6 text-white sm:px-6 md:px-8 md:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.10),transparent_22%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative mx-auto max-w-2xl"
        >
          <Link href="/dashboard">
            <motion.div
              whileHover={{ x: -3 }}
              className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </motion.div>
          </Link>

          <div className="rounded-[36px] border border-white/10 bg-black/35 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:rounded-[42px] md:p-7">
            <header className="border-b border-white/10 pb-5">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/70">
                HabitHub Dashboard
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                My Profile
              </h1>
            </header>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="mt-6 space-y-5"
            >
              <motion.div variants={itemVariants}>
                <Card className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/15 bg-gradient-to-br from-indigo-500/25 to-cyan-500/15 text-2xl font-semibold text-white shadow-[0_0_32px_rgba(79,70,229,0.3)]">
                      {initials}
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#07090F] bg-emerald-400 shadow">
                      <Check className="h-3 w-3 text-black" strokeWidth={3} />
                    </span>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                      Active member
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                      {username}
                    </h2>
                    <p className="mt-0.5 text-sm text-white/50">{email}</p>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card>
                  <SectionTitle
                    icon={<User className="h-4.5 w-4.5" />}
                    title="Account Details"
                  />
                  <div className="space-y-3">
                    <Field
                      label="Username"
                      value={username}
                      icon={<User className="h-4 w-4" />}
                    />
                    <Field
                      label="Email"
                      value={email}
                      icon={<Mail className="h-4 w-4" />}
                    />
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card>
                  <SectionTitle
                    icon={<ShieldCheck className="h-4.5 w-4.5" />}
                    title="Actions"
                  />
                  <div className="space-y-3">
                    <ActionButton
                      icon={<Pencil className="h-4.5 w-4.5" />}
                      label="Edit profile details"
                      description="Update your username and email address"
                      accent="indigo"
                      onClick={() => setModal("edit")}
                    />
                    <ActionButton
                      icon={<Lock className="h-4.5 w-4.5" />}
                      label="Change password"
                      description="Update your account password"
                      accent="emerald"
                      onClick={() => setModal("password")}
                    />
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </main>

      <AnimatePresence>
        {modal === "edit" && (
          <EditProfileModal
            key="edit"
            username={username}
            email={email}
            onClose={() => setModal(null)}
            onSave={handleSaveProfile}
          />
        )}
        {modal === "password" && (
          <ChangePasswordModal
            key="password"
            onClose={() => setModal(null)}
            onSave={handleSavePassword}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastBar key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}