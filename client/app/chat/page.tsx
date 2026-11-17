"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Heart, Send, Smile, Image as ImageIcon } from "lucide-react";

import BottomNav from "../../components/layout/BottomNav";
import { getCurrentUser, AuthError, type AuthUser } from "../../lib/auth";

interface Message {
  id: number;
  sender: "me" | "partner";
  text: string;
  time: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    sender: "partner",
    text: "Good morning, my love! ❤️",
    time: "9:00 AM",
  },
  { id: 2, sender: "me", text: "Morning! Sleep well?", time: "9:05 AM" },
  {
    id: 3,
    sender: "partner",
    text: "Like a baby, thinking of you today.",
    time: "9:06 AM",
  },
];

export default function ChatPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now(),
      sender: "me",
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#09090f] text-sm text-gray-400">
        <div className="h-8 w-8 animate-pulse rounded-2xl bg-pink-500/20 flex items-center justify-center text-pink-400">
          <Heart size={18} fill="currentColor" />
        </div>
        <span>Loading chat...</span>
      </main>
    );
  }

  if (!authUser) return null;

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex justify-center selection:bg-pink-500/30">
      <main className="w-full max-w-md min-h-screen flex flex-col relative bg-[#0d0d14] border-x border-white/[0.06] shadow-2xl">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 bg-[#0d0d14]/85 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-pink-500/25">
                <Heart size={19} fill="currentColor" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0d0d14] rounded-full" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white leading-none">
                Partner
              </div>
              <div className="text-[10px] font-semibold tracking-widest text-emerald-400 uppercase mt-1">
                Online
              </div>
            </div>
          </div>
        </header>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-36">
          {messages.map((msg) => {
            const isMe = msg.sender === "me";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-br-xs shadow-pink-950/30"
                      : "bg-[#15151f] text-gray-200 border border-white/[0.08] rounded-bl-xs"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1">
                  {msg.time}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={handleSend}
          className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 py-3 bg-[#0d0d14]/90 backdrop-blur-2xl border-t border-white/[0.08] flex items-center gap-2 z-20"
        >
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-pink-400 transition-colors"
          >
            <ImageIcon size={20} />
          </button>
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-pink-400 transition-colors"
          >
            <Smile size={20} />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a sweet message..."
            className="flex-1 bg-[#15151f] border border-white/[0.08] rounded-full px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
          />

          <button
            type="submit"
            className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-full flex items-center justify-center shadow-md shadow-pink-500/30 transition-all shrink-0 active:scale-95"
          >
            <Send size={16} />
          </button>
        </form>

        <BottomNav
          activeTab="chat"
          onTabChange={(tab) => router.push(`/${tab === "home" ? "" : tab}`)}
        />
      </main>
    </div>
  );
}
