"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../auxiliary/apiFetch";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function logout() {
      console.log("Logging out");
      
      const sessionId = localStorage.getItem("sessionId");
      console.log(sessionId);
      try {
        if (sessionId) {
          await apiFetch<void>(`/api/sessions/${sessionId}`, {
            method: "DELETE",
          });
        }
      } catch (e) {
        console.log(e instanceof Error ? e.message : "Failed to terminate the session");
      } finally {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("sessionId");

        router.replace("/login");
      }
    }

    void logout();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#07090F] text-white">
      <p className="text-sm text-white/60">Logging you out...</p>
    </div>
  );
}