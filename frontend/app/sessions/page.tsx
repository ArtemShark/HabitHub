"use client";

import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
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
  Laptop,
  Smartphone,
  Tablet,
} from "lucide-react";
import { apiFetch, getToken } from "../auxiliary/apiFetch";
import { Session } from "../dto/Session";
import { getCurrentUserId } from "../auxiliary/getCurrentUserId";
import { email } from "zod";
import SectionTitle from "../components/SectionTitle";
import Card from "../components/Card";
import { itemVariants} from "../auxiliary/variants/itemVariant";

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
async function fetchSessionsForMember(memberId: string): Promise<Session[]> {
  return apiFetch<Session[]>(`/api/sessions`, {
    method: "GET",
  });
}


export default function ProfilePage() {
  
    const [sessions, setSessions] = useState<Session[]>([]);
    const currentUserId = useMemo(() => getCurrentUserId(), []);

    useEffect(() => {
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
        loadSessions();
    },[currentUserId]);

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
          
        </motion.div>
      </main>
    </>
  );
}