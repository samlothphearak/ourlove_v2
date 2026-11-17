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
      className="fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-md bg-[#0d0d14]/85 backdrop-blur-2xl border-t border-white/[0.08] px-3 py-2 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
    >
      {/* Subtle Top Glow Border */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/20 to-transparent" />

      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={`group relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-300 active:scale-95 ${
              isActive
                ? "text-pink-300 bg-pink-500/15 font-semibold shadow-sm shadow-pink-950/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
            }`}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.4 : 1.8}
              className={`transition-transform duration-300 group-hover:scale-110 ${
                isActive ? "text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.4)]" : ""
              }`}
            />
            <span className="text-[10px] mt-1 tracking-tight">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}