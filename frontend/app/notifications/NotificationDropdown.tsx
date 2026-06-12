"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
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

const focusableSelector =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function NotificationDropdown({
  loadOnMount = true,
}: NotificationDropdownProps = {}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(
    null
  );

  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<Notification[]>("/api/notifications");

      if (isMountedRef.current) {
        setNotifications(data);
      }
    } catch (err) {
      console.error(err);

      if (isMountedRef.current) {
        setNotifications([]);
      }
    }
  }, []);

  useEffect(() => {
    if (!loadOnMount) {
      return;
    }

    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    window.addEventListener("focus", loadNotifications);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadNotifications);
    };
  }, [loadOnMount, loadNotifications]);

  useEffect(() => {
    if (open) {
      void loadNotifications();
    }
  }, [open, loadNotifications]);

  async function markAsRead(notificationId: string) {
    const notification = notifications.find(
      (n) => n.notificationId === notificationId
    );

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

  function openNotification(notificationId: string) {
    setExpandedNotificationId((current) =>
      current === notificationId ? null : notificationId
    );

    void markAsRead(notificationId);
  }

  async function deleteNotification(notificationId: string) {
    setNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notificationId)
    );

    setExpandedNotificationId((current) =>
      current === notificationId ? null : current
    );

    try {
      await apiFetch<void>(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error(err);

      try {
        const data = await apiFetch<Notification[]>("/api/notifications");
        setNotifications(data);
      } catch {
      }
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

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;

    window.setTimeout(() => {
      const firstFocusable =
        panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      firstFocusable?.focus();
    }, 0);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) {
        e.preventDefault();
        triggerRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <motion.button
        ref={triggerRef}
        whileHover={{ y: -2, scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close notifications" : "Open notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notifications-dropdown"
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10 hover:text-white md:h-12 md:w-12"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />

        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id="notifications-dropdown"
            role="dialog"
            aria-modal="false"
            aria-label="Notifications"
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
                notifications.map((n) => {
                  const isExpanded =
                    expandedNotificationId === n.notificationId;

                  return (
                    <div
                      key={n.notificationId}
                      role="button"
                      tabIndex={0}
                      onClick={() => openNotification(n.notificationId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openNotification(n.notificationId);
                        }
                      }}
                      aria-expanded={isExpanded}
                      aria-label={`${n.read ? "Read" : "Unread"} notification: ${
                        n.content
                      }`}
                      title={n.content}
                      className={`group flex cursor-pointer items-start justify-between gap-4 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 ${
                        !n.read ? "bg-white/[0.03]" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[15px] font-medium text-white ${
                            isExpanded
                              ? "whitespace-normal break-words leading-6"
                              : "truncate"
                          }`}
                        >
                          {n.content}
                        </p>

                        {isExpanded && (
                          <p className="mt-2 text-xs text-white/40">
                            Click again to collapse
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {n.createdAt && (
                          <span className="text-right text-xs text-white/35">
                            {formatNotificationTimestamp(n.createdAt)}
                          </span>
                        )}

                        <button
                          type="button"
                          aria-label={`Delete notification: ${n.content}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteNotification(n.notificationId);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-rose-400/70"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })
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