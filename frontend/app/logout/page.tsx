"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    router.replace("/login");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#07090F] text-white">
      <p className="text-sm text-white/60">Logging you out...</p>
    </div>
  );
}
