import { AnimatePresence, motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, User, LogOut } from "lucide-react";

export default function SettingsDropdown() {
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