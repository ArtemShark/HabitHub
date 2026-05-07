"use client";

import { Bell, Clock3 } from "lucide-react";
import NotificationDropdown from "@/app/notifications/NotificationDropdown";
import IconButton from "./IconButton";
import SettingsDropdown from "./SettingsDropdown";
import TopNavigation from "./TopNavigation";

type PageHeaderProps = {
  title: string;
  subtitle: string;
  activePage: "dashboard" | "teams" | "habits" | "progress";
};

export default function PageHeader({
  title,
  subtitle,
  activePage,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/70">
            HabitHub
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {title}
          </h1>

          <p className="mt-2 text-sm text-white/50">{subtitle}</p>
        </div>

        <TopNavigation activePage={activePage} />
      </div>

      <div className="flex items-center gap-3 self-start lg:self-auto">
        <NotificationDropdown />

        <IconButton href="/sessions">
          <Clock3 className="h-5 w-5" />
        </IconButton>

        <SettingsDropdown />
      </div>
    </header>
  );
}