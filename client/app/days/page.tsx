"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Heart, Plus, Sparkles } from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import BottomNav from "../../components/layout/BottomNav";
import { getCurrentUser, AuthError, type AuthUser } from "../../lib/auth";

interface Milestone {
  id: number;
  title: string;
  date: string;
  daysPassed: number;
}

const MILESTONES: Milestone[] = [
  { id: 1, title: "First Date", date: "October 12, 2024", daysPassed: 504 },
  {
    id: 2,
    title: "Said 'I Love You'",
    date: "November 28, 2024",
    daysPassed: 456,
  },
  { id: 3, title: "Moved In Together", date: "June 15, 2025", daysPassed: 257 },
];

export default function DaysPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setAuthUser(user))
      .catch((error) => {
        if (error instanceof AuthError && error.status === 401)
          router.replace("/login");
      })
      .finally(() => setIsCheckingSession(false));
  }, [router]);

  if (isCheckingSession)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090f] text-sm text-gray-300">
        Loading days...
      </main>
    );
  if (!authUser) return null;

  return (
    <main className="app-shell pb-28">
      <header className="topbar flex items-center justify-between">
        <div className="brand flex items-center gap-3">
          <div className="brand-icon">
            <CalendarDays size={19} />
          </div>
          <div>
            <div className="brand-name">Our Days</div>
            <div className="brand-caption">SPECIAL DATES & MILESTONES</div>
          </div>
        </div>
        <button
          type="button"
          className="w-9 h-9 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="content space-y-6 pt-4">
        {/* Main Anniversary Hero Card */}
        <Card className="p-6 bg-gradient-to-br from-rose-500 to-pink-500 text-white rounded-3xl shadow-lg shadow-rose-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Together Forever
            </span>
            <Heart size={20} fill="currentColor" className="text-pink-200" />
          </div>

          <div className="my-6 text-center">
            <div className="text-5xl font-light tracking-tight">504</div>
            <div className="text-sm font-medium tracking-widest uppercase mt-1 text-rose-100">
              Days of Loving You
            </div>
          </div>

          <div className="pt-3 border-t border-white/20 flex items-center justify-between text-xs text-rose-100">
            <span>Since October 12, 2024</span>
            <Sparkles size={16} />
          </div>
        </Card>

        {/* Milestone List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Milestone Timeline
          </h3>

          {MILESTONES.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white rounded-2xl border border-rose-100 shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <Heart size={18} fill="currentColor" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-800">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">{item.date}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-rose-500">
                  +{item.daysPassed}
                </span>
                <span className="block text-[10px] text-slate-400 uppercase">
                  days
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav
        activeTab="days"
        onTabChange={(tab) => router.push(`/${tab === "home" ? "" : tab}`)}
      />
    </main>
  );
}
