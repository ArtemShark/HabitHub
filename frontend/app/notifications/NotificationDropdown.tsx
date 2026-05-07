"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { apiFetch } from "../auxiliary/apiFetch";

type Notification = {
  notificationId: string;
  content: string;
  createdAt?: string;
  read?: boolean;
};

type NotificationDropdownProps = {
  loadOnMount?: boolean;
};

export default function NotificationDropdown({
  loadOnMount = process.env.NODE_ENV !== "test",
}: NotificationDropdownProps = {}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        const data = await apiFetch<Notification[]>("/api/notifications");

        if (!cancelled) {
          setNotifications(data);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setNotifications([]);
        }
      }
    }

    loadNotifications();

    window.addEventListener("focus", loadNotifications);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadNotifications);
    };
  }, []);

  async function markAsRead(notificationId: string) {
    const notification = notifications.find((n) => n.notificationId === notificationId);

    if (!notification || notification.read) {
      return;
    }

    setNotifications((prev) =>
      prev.map((n) =>
        n.notificationId === notificationId ? { ...n, read: true } : n
      )
    );

    try {
      await apiFetch<void>(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
      });
    } catch (err) {
      console.error(err);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, read: false } : n
        )
      );
    }
  }


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
                    role="button"
                    tabIndex={0}
                    onClick={() => markAsRead(n.notificationId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        markAsRead(n.notificationId);
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-4 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 ${
                      !n.read ? "bg-white/[0.03]" : ""
                    }`}
                  >

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-white">
                        {n.content}
                      </p>
                    </div>

                    {n.createdAt && (
                      <span className="shrink-0 text-right text-xs text-white/35">
                        {formatNotificationTimestamp(n.createdAt)}
                      </span>
                    )}
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


function formatNotificationTimestamp(date: string) {
  const d = new Date(date);
  const datePart = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const timePart = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart}, ${timePart}`;
}
