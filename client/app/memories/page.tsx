"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Plus, Images, Calendar } from "lucide-react";

import Button from "../../components/ui/Button";
import BottomNav from "../../components/layout/BottomNav";
import { getCurrentUser, AuthError, type AuthUser } from "../../lib/auth";

interface MemoryItem {
  id: number;
  title: string;
  date: string;
  image: string;
  category: string;
}

const ALL_MEMORIES: MemoryItem[] = [
  {
    id: 1,
    title: "Our first adventure",
    date: "Oct 12, 2025",
    image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=700",
    category: "Travel",
  },
  {
    id: 2,
    title: "Cozy movie night",
    date: "Nov 03, 2025",
    image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=700",
    category: "Dates",
  },
  {
    id: 3,
    title: "Sunset walk at the beach",
    date: "Dec 20, 2025",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=700",
    category: "Outdoors",
  },
  {
    id: 4,
    title: "Coffee date surprise",
    date: "Jan 14, 2026",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=700",
    category: "Dates",
  },
];

export default function MemoriesPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");

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
        Loading memories...
      </main>
    );
  if (!authUser) return null;

  const filteredMemories =
    selectedCategory === "All"
      ? ALL_MEMORIES
      : ALL_MEMORIES.filter((m) => m.category === selectedCategory);

  return (
    <main className="app-shell pb-28">
      <header className="topbar flex items-center justify-between">
        <div className="brand flex items-center gap-3">
          <div className="brand-icon">
            <Images size={19} />
          </div>
          <div>
            <div className="brand-name">Memories</div>
            <div className="brand-caption">CAPTURED FOREVER</div>
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
        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {["All", "Travel", "Dates", "Outdoors"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-rose-500 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-rose-100 hover:bg-rose-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Masonry / Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          {filteredMemories.map((memory) => (
            <div
              key={memory.id}
              className="group relative rounded-2xl overflow-hidden bg-white border border-rose-100 shadow-xs hover:shadow-md transition-all"
            >
              <img
                src={memory.image}
                alt={memory.title}
                className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent flex flex-col justify-end p-3 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300">
                  {memory.category}
                </span>
                <h3 className="font-semibold text-sm leading-tight mt-0.5">
                  {memory.title}
                </h3>
                <p className="text-[11px] text-slate-300 flex items-center gap-1 mt-1">
                  <Calendar size={12} /> {memory.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav
        activeTab="memories"
        onTabChange={(tab) => router.push(`/${tab === "home" ? "" : tab}`)}
      />
    </main>
  );
}
