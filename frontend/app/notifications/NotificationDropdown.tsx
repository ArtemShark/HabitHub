"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";

type Notification = {
  notificationId: string;
  content: string;
  createdAt: string;
  read?: boolean;
};

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifications([
      {
        notificationId: "1",
        content: "Password changed successfully",
        createdAt: "2025-06-21T22:30:00Z",
      },
      {
        notificationId: "2",
        content: "Email updated successfully",
        createdAt: "2025-06-24T22:30:00Z",
      },
    ]);
  }, []);


  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">

      <motion.button
        whileHover={{ y: -2, scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10 hover:text-white md:h-12 md:w-12"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </motion.button>


      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-14 z-50 w-96 overflow-hidden rounded-[20px] border border-white/10 bg-[#0D1117]/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          >

            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-sm font-medium text-white">Notifications</p>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-white/50">
                  No notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.notificationId}
                    className={`flex items-center justify-between border-b border-white/5 px-4 py-3 transition hover:bg-white/5 ${
                      !n.read ? "bg-white/[0.03]" : ""
                    }`}
                  >

                    <p className="flex-1 truncate text-[15px] font-medium text-white">
                      {n.content}
                    </p>

                    <div className="ml-4 flex flex-col items-end shrink-0 text-xs leading-tight">
                      <span className="text-white/40">
                        {formatDateOnly(n.createdAt)}
                      </span>
                      <span className="text-white/30">
                        {formatTimeOnly(n.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


function formatDateOnly(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeOnly(date: string) {
  const d = new Date(date);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}