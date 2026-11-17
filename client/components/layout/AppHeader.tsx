"use client";

import { Heart, MoreHorizontal, type LucideIcon } from "lucide-react";

interface AppHeaderProps {
  title?: string;
  caption?: string;
  brandIcon?: LucideIcon;
  onMoreClick?: () => void;
  rightAction?: React.ReactNode;
  isConnected?: boolean;
}

export default function AppHeader({
  title = "OurLove",
  caption = "YOUR PRIVATE WORLD",
  brandIcon: BrandIcon = Heart,
  onMoreClick,
  rightAction,
  isConnected = true,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 bg-[#09090f]/75 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Subtle Top Rim Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-400/30 to-transparent" />

      {/* Brand / Logo Section */}
      <div className="flex items-center gap-3.5">
        <div className="relative group">
          {/* Ambient Glow behind icon */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-pink-500/40 to-amber-300/30 blur-md opacity-75 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Glassmorphic Emblem Container */}
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-rose-600 p-[1px] shadow-inner">
            <div className="w-full h-full rounded-[15px] bg-gradient-to-br from-white/20 to-transparent flex items-center justify-center text-white">
              <BrandIcon
                size={18}
                fill="currentColor"
                className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:scale-110"
              />
            </div>
          </div>

          {/* Live Presence Status Dot */}
          {isConnected && (
            <span
              title="Connected"
              className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border-2 border-[#09090f]" />
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1 font-bold text-lg tracking-tight leading-none">
            <span className="bg-gradient-to-r from-white via-white to-pink-100 bg-clip-text text-transparent">
              {title}
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-pink-400 to-amber-300 translate-y-[2px]" />
          </div>

          <span className="text-[9px] font-semibold tracking-[0.22em] text-pink-200/50 uppercase mt-1.5">
            {caption}
          </span>
        </div>
      </div>

      {/* Right Action / More Options */}
      <div className="flex items-center">
        {rightAction ? (
          rightAction
        ) : (
          <button
            type="button"
            onClick={onMoreClick}
            aria-label="More options"
            className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/[0.08] hover:border-pink-400/30 active:scale-95 transition-all duration-200 shadow-xs"
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>
    </header>
  );
}