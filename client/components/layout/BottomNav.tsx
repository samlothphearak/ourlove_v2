"use client";

import {
  House,
  MessageCircle,
  Images,
  CalendarDays,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type TabId = "home" | "chat" | "memories" | "days" | "us";

export interface Tab {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  tabs?: Tab[];
}

const DEFAULT_TABS: Tab[] = [
  { id: "home", label: "Home", icon: House },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "memories", label: "Memories", icon: Images },
  { id: "days", label: "Our Days", icon: CalendarDays },
  { id: "us", label: "Us", icon: UserRound },
];

export default function BottomNav({
  activeTab,
  onTabChange,
  tabs = DEFAULT_TABS,
}: BottomNavProps) {
  return (
    <nav
      aria-label="Primary Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-md bg-white/90 backdrop-blur-lg border-t border-rose-100/80 px-3 py-2 flex items-center justify-around shadow-lg shadow-rose-100/30"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={`group relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 ${
              isActive
                ? "text-rose-600 bg-rose-50/90 font-semibold scale-105 shadow-xs"
                : "text-slate-400 hover:text-slate-600 hover:bg-rose-50/40"
            }`}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.4 : 1.8}
              className="transition-transform duration-200 group-hover:scale-110"
            />
            <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
