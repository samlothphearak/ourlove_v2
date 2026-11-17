"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Heart, Plus, Sparkles } from "lucide-react";

import Card from "../../components/ui/Card";
import AppHeader from "../../components/layout/AppHeader";
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
        if (error instanceof AuthError && error.status === 401) {
          router.replace("/login");
        }
      })
      .finally(() => setIsCheckingSession(false));
  }, [router]);

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#09090f] text-sm text-gray-400">
        <div className="h-8 w-8 animate-pulse rounded-2xl bg-pink-500/20 flex items-center justify-center text-pink-400">
          <Heart size={18} fill="currentColor" />
        </div>
        <span>Loading days...</span>
      </main>
    );
  }

  if (!authUser) return null;

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex justify-center selection:bg-pink-500/30">
      <main className="w-full max-w-md min-h-screen flex flex-col relative bg-[#0d0d14] border-x border-white/[0.06] shadow-2xl pb-32">
        <AppHeader
          title="Our Days"
          caption="SPECIAL DATES & MILESTONES"
          brandIcon={CalendarDays}
          rightAction={
            <button
              type="button"
              aria-label="Add milestone"
              className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 hover:bg-pink-500/25 flex items-center justify-center transition-all shadow-sm active:scale-95"
            >
              <Plus size={18} />
            </button>
          }
        />

        <div className="content px-5 pt-6 space-y-6">
          {/* Main Anniversary Hero Card */}
          <Card className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#1f1627] via-[#181524] to-[#13131d] border border-pink-500/20 shadow-xl shadow-pink-950/20 text-white">
            {/* Ambient Glows */}
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-white/[0.06] border border-white/[0.08] px-3 py-1 rounded-full text-pink-200">
                Together Forever
              </span>
              <Heart size={20} fill="currentColor" className="text-pink-400" />
            </div>

            <div className="relative z-10 my-6 text-center">
              <div className="text-5xl font-light tracking-tight text-white">
                504
              </div>
              <div className="text-sm font-medium tracking-widest uppercase mt-1 text-pink-300/80">
                Days of Loving You
              </div>
            </div>

            <div className="relative z-10 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-gray-300">
              <span>Since October 12, 2024</span>
              <Sparkles size={16} className="text-pink-400" />
            </div>
          </Card>

          {/* Milestone List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
              Milestone Timeline
            </h3>

            {MILESTONES.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-[#15151f] rounded-3xl border border-white/[0.08] shadow-lg flex items-center justify-between hover:border-pink-500/30 transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0 border border-pink-500/20">
                    <Heart size={18} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-white">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">{item.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-pink-400">
                    +{item.daysPassed}
                  </span>
                  <span className="block text-[10px] text-gray-500 uppercase">
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
    </div>
  );
}
