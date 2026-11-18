"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Send, X } from "lucide-react";
import { io, type Socket } from "socket.io-client";

import BottomNav from "../../components/layout/BottomNav";
import { getCurrentUser, AuthError, type AuthUser } from "../../lib/auth";
import {
  API_URL,
  ApiError,
  getMemories,
  getChatMessages,
  type ChatMessage,
  type ChatMemoryAttachment,
  type MemoryRecord,
} from "../../lib/api";
import { getPartnerStatus, type PartnerSummary } from "../../lib/partner";

interface ChatServerEvents {
  "chat:message": (message: ChatMessage) => void;
  "chat:seen": (receipt: {
    readerId: string;
    throughMessageId: string;
    seenAt: string;
  }) => void;
  "chat:presence": (presence: {
    userId: string;
    isOnline: boolean;
    lastSeenAt: string | null;
  }) => void;
  "chat:unavailable": () => void;
}

interface ChatClientEvents {
  "chat:mark_seen": (
    acknowledge?: (response: { success: boolean; message?: string }) => void,
  ) => void;
  "chat:send": (
    payload: { text: string; memoryId?: string },
    acknowledge: (response: { success: boolean; message?: string }) => void,
  ) => void;
}

type ChatSocket = Socket<ChatServerEvents, ChatClientEvents>;
type ConnectionState = "connecting" | "connected" | "disconnected";

interface ChatSeenReceipt {
  readerId: string;
  throughMessageId: string;
  seenAt: string;
}

function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort(
    (first, second) =>
      Date.parse(first.createdAt) - Date.parse(second.createdAt) ||
      first.id.localeCompare(second.id),
  );
}

function applySeenReceipt(
  messages: ChatMessage[],
  currentUserId: string,
  receipt: ChatSeenReceipt,
): ChatMessage[] {
  const throughIndex = messages.findIndex(
    (message) => message.id === receipt.throughMessageId,
  );
  if (throughIndex < 0) return messages;
  return messages.map((message, index) =>
    index <= throughIndex &&
    message.senderId === currentUserId &&
    !message.seenAt
      ? { ...message, seenAt: receipt.seenAt }
      : message,
  );
}

function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPartnerLastSeen(value: string | null): string {
  if (!value) return "Offline";
  const lastSeen = Date.parse(value);
  if (Number.isNaN(lastSeen)) return "Offline";

  const minutes = Math.max(0, Math.floor((Date.now() - lastSeen) / 60_000));
  if (minutes === 0) return "Offline · just now";
  if (minutes < 60) return `Offline · ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Offline · ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Offline · ${days}d ago`;
  return `Offline · ${new Date(value).toLocaleDateString()}`;
}

export default function ChatPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [partner, setPartner] = useState<PartnerSummary | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageError, setPageError] = useState("");
  const [memoryContext, setMemoryContext] = useState<MemoryRecord | null>(null);
  const [memoryContextError, setMemoryContextError] = useState("");
  const [viewingMemory, setViewingMemory] =
    useState<ChatMemoryAttachment | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerLastSeenAt, setPartnerLastSeenAt] = useState<string | null>(
    null,
  );
  const [, setRelativeTimeRefresh] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [socketError, setSocketError] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollHeightBeforeLoadRef = useRef<number | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      try {
        const user = await getCurrentUser();
        if (!active) return;
        setAuthUser(user);
        const currentPartner = await getPartnerStatus();
        if (active) {
          setPartner(currentPartner);
          setPartnerLastSeenAt(currentPartner?.lastSeenAt ?? null);
        }

        const memoryId = new URLSearchParams(window.location.search).get(
          "memoryId",
        );
        if (memoryId) {
          try {
            const availableMemories = await getMemories();
            if (!active) return;
            const selectedMemory = availableMemories.find(
              (memory) => memory.id === memoryId,
            );
            if (selectedMemory) {
              setMemoryContext(selectedMemory);
              setInputText(
                (current) =>
                  current ||
                  `I was thinking about "${selectedMemory.title}" ❤️`,
              );
            } else {
              setMemoryContextError(
                "That memory is no longer available to share in chat.",
              );
            }
          } catch (error) {
            if (!active) return;
            if (
              (error instanceof AuthError || error instanceof ApiError) &&
              error.status === 401
            ) {
              router.replace("/login");
            } else {
              setMemoryContextError(
                error instanceof Error
                  ? error.message
                  : "Unable to load the selected memory.",
              );
            }
          }
        }
      } catch (error) {
        if (
          (error instanceof AuthError || error instanceof ApiError) &&
          error.status === 401
        ) {
          router.replace("/login");
        } else if (active) {
          setPageError(
            error instanceof Error ? error.message : "Unable to load chat.",
          );
        }
      } finally {
        if (active) setIsLoadingPage(false);
      }
    }

    void loadPage();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setRelativeTimeRefresh((value) => value + 1),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authUser || !partner) return;

    const currentUserId = authUser.id;
    let active = true;
    let historyLoaded = false;
    const messagesReceivedDuringLoad: ChatMessage[] = [];
    const seenReceiptsDuringLoad: ChatSeenReceipt[] = [];
    const markConversationSeen = () => {
      if (
        active &&
        historyLoaded &&
        socket.connected &&
        document.visibilityState === "visible"
      ) {
        socket.emit("chat:mark_seen");
      }
    };

    const socket = io(API_URL, {
      withCredentials: true,
    }) as ChatSocket;
    socketRef.current = socket;

    socket.on("connect", () => {
      if (!active) return;
      setConnectionState("connected");
      setSocketError("");
      markConversationSeen();
    });
    socket.on("disconnect", () => {
      if (!active) return;
      setConnectionState("disconnected");
      setPartnerOnline(false);
      setIsSending(false);
    });
    socket.on("connect_error", (error) => {
      if (!active) return;
      setConnectionState("disconnected");
      if (error.message === "AUTH_REQUIRED") {
        router.replace("/login");
      } else if (error.message === "PARTNER_REQUIRED") {
        setPartner(null);
        setPartnerLastSeenAt(null);
        setHistoryError("Connect with your partner to open your chat.");
      } else {
        setSocketError(
          "Chat connection failed. Check your connection and retry.",
        );
      }
    });
    socket.on("chat:presence", ({ userId, isOnline, lastSeenAt }) => {
      if (active && userId === partner.id) {
        setPartnerOnline(isOnline);
        setPartnerLastSeenAt(isOnline ? null : lastSeenAt);
      }
    });
    socket.on("chat:message", (message) => {
      if (!active) return;
      if (!historyLoaded) {
        messagesReceivedDuringLoad.push(message);
      } else {
        setMessages((current) => mergeMessages(current, [message]));
      }
      if (message.senderId === partner.id) markConversationSeen();
    });
    socket.on("chat:seen", (receipt) => {
      const { readerId } = receipt;
      if (!active || readerId !== partner.id) return;
      if (!historyLoaded) {
        seenReceiptsDuringLoad.push(receipt);
        return;
      }
      setMessages((current) =>
        applySeenReceipt(current, currentUserId, receipt),
      );
    });
    socket.on("chat:unavailable", () => {
      if (!active) return;
      setPartner(null);
      setPartnerLastSeenAt(null);
      setMessages([]);
      setPartnerOnline(false);
      setConnectionState("disconnected");
      setHistoryError(
        "Your partner connection ended. Reconnect from your Us page to chat again.",
      );
    });

    async function loadHistory() {
      try {
        const page = await getChatMessages();
        if (!active) return;
        historyLoaded = true;
        setMessages(() => {
          let loadedMessages = mergeMessages(
            page.messages,
            messagesReceivedDuringLoad,
          );
          for (const receipt of seenReceiptsDuringLoad) {
            loadedMessages = applySeenReceipt(
              loadedMessages,
              currentUserId,
              receipt,
            );
          }
          return loadedMessages;
        });
        setNextCursor(page.nextCursor);
        markConversationSeen();
      } catch (error) {
        if (!active) return;
        if (
          (error instanceof ApiError || error instanceof AuthError) &&
          error.status === 401
        ) {
          router.replace("/login");
        } else if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 409)
        ) {
          setPartner(null);
          setPartnerLastSeenAt(null);
          setHistoryError("Connect with your partner to open your chat.");
        } else {
          setHistoryError(
            error instanceof Error
              ? error.message
              : "Unable to load your chat history.",
          );
        }
        historyLoaded = true;
        if (messagesReceivedDuringLoad.length) {
          setMessages(() => {
            let loadedMessages = mergeMessages([], messagesReceivedDuringLoad);
            for (const receipt of seenReceiptsDuringLoad) {
              loadedMessages = applySeenReceipt(
                loadedMessages,
                currentUserId,
                receipt,
              );
            }
            return loadedMessages;
          });
          markConversationSeen();
        }
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    }

    void loadHistory();
    document.addEventListener("visibilitychange", markConversationSeen);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", markConversationSeen);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authUser, partner, router]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const previousHeight = scrollHeightBeforeLoadRef.current;
    if (previousHeight !== null) {
      container.scrollTop += container.scrollHeight - previousHeight;
      scrollHeightBeforeLoadRef.current = null;
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadOlderMessages() {
    if (!nextCursor || isLoadingOlder || !messagesContainerRef.current) return;
    setIsLoadingOlder(true);
    try {
      const page = await getChatMessages(nextCursor);
      const container = messagesContainerRef.current;
      if (!container) return;
      setHistoryError("");
      scrollHeightBeforeLoadRef.current = container.scrollHeight;
      setMessages((current) => mergeMessages(page.messages, current));
      setNextCursor(page.nextCursor);
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Unable to load older messages.",
      );
    } finally {
      setIsLoadingOlder(false);
    }
  }

  function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = inputText.trim();
    const socket = socketRef.current;
    if (!text || text.length > 2000 || !socket?.connected || isSending) return;

    const sentMemoryId = memoryContext?.id;
    setIsSending(true);
    setSocketError("");
    socket.emit(
      "chat:send",
      { text, ...(sentMemoryId ? { memoryId: sentMemoryId } : {}) },
      (response) => {
        setIsSending(false);
        if (!response.success) {
          setSocketError(response.message || "Your message could not be sent.");
          return;
        }
        setInputText("");
        if (sentMemoryId) {
          setMemoryContext((current) =>
            current?.id === sentMemoryId ? null : current,
          );
          router.replace("/chat");
        }
      },
    );
  }

  if (isLoadingPage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#09090f] text-sm text-gray-400">
        <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-2xl bg-pink-500/20 text-pink-400">
          <Heart size={18} fill="currentColor" />
        </div>
        <span>Loading chat...</span>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090f] px-6 text-center text-sm text-rose-300">
        {pageError}
      </main>
    );
  }
  if (!authUser) return null;

  const canSend = Boolean(
    partner &&
    connectionState === "connected" &&
    inputText.trim() &&
    !isSending,
  );
  const lastSeenOwnMessageId = [...messages]
    .reverse()
    .find((message) => message.senderId === authUser.id && message.seenAt)?.id;
  const presenceLabel = !partner
    ? "Not connected"
    : connectionState === "connecting"
      ? "Connecting..."
      : connectionState === "disconnected"
        ? "Reconnecting..."
        : partnerOnline
          ? "Online"
          : formatPartnerLastSeen(partnerLastSeenAt);

  return (
    <div className="flex min-h-screen justify-center bg-[#09090f] text-white selection:bg-pink-500/30">
      <main className="relative flex min-h-screen w-full max-w-md flex-col border-x border-white/[0.06] bg-[#0d0d14] shadow-2xl">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#0d0d14]/85 px-5 py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-lg shadow-pink-500/25">
              {partner?.profileImageUrl ? (
                <img
                  src={partner.profileImageUrl}
                  alt={`${partner.name}'s profile`}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <Heart size={1} fill="currentColor" />
              )}
              {partnerOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0d0d14] bg-emerald-400" />
              )}
            </div>
            <div>
              <div className="text-base font-bold leading-none tracking-tight text-white">
                {partner?.name || "OurLove Chat"}
              </div>
              <div
                className={`mt-1 text-[10px] font-semibold uppercase tracking-widest ${
                  connectionState === "connected" && partnerOnline
                    ? "text-emerald-400"
                    : "text-gray-500"
                }`}
              >
                {presenceLabel}
              </div>
            </div>
          </div>
        </header>

        {(memoryContext || memoryContextError) && (
          <section className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-pink-400/20 bg-pink-500/[0.08] px-3 py-2.5">
            <Heart size={16} className="shrink-0 text-pink-300" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pink-300">
                {memoryContext
                  ? "Attach this memory to your message"
                  : "Memory context"}
              </p>
              <p className="truncate text-sm text-gray-100">
                {memoryContext?.title || memoryContextError}
              </p>
            </div>
            {memoryContext && (
              <button
                type="button"
                aria-label="Remove memory context"
                onClick={() => {
                  setMemoryContext(null);
                  setMemoryContextError("");
                  router.replace("/chat");
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={15} />
              </button>
            )}
          </section>
        )}

        <div
          ref={messagesContainerRef}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-6 pb-40"
        >
          {!partner ? (
            <section className="mx-auto mt-16 max-w-xs rounded-3xl border border-white/[0.08] bg-[#15151f] p-6 text-center">
              <Heart className="mx-auto mb-3 text-pink-400" size={26} />
              <h1 className="text-lg font-semibold">
                Your chat starts together
              </h1>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                Connect with your partner to share private messages in real
                time.
              </p>
              {historyError && (
                <p role="alert" className="mt-3 text-xs text-rose-300">
                  {historyError}
                </p>
              )}
              <Link
                href="/us"
                className="mt-5 inline-flex rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-400"
              >
                Go to Us
              </Link>
            </section>
          ) : (
            <>
              {nextCursor && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadOlderMessages()}
                    disabled={isLoadingOlder}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-gray-400 transition hover:border-pink-400/40 hover:text-pink-300 disabled:opacity-50"
                  >
                    {isLoadingOlder ? "Loading..." : "Load older messages"}
                  </button>
                </div>
              )}
              {isLoadingHistory && (
                <p className="py-8 text-center text-sm text-gray-500">
                  Loading your messages...
                </p>
              )}
              {!isLoadingHistory && messages.length === 0 && (
                <p className="py-12 text-center text-sm text-gray-500">
                  Say hello to start your conversation.
                </p>
              )}
              {messages.map((message) => {
                const isMe = message.senderId === authUser.id;
                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isMe
                          ? "rounded-br-sm bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-pink-950/30"
                          : "rounded-bl-sm border border-white/[0.08] bg-[#15151f] text-gray-200"
                      }`}
                    >
                      {message.memory && (
                        <button
                          type="button"
                          onClick={() => setViewingMemory(message.memory)}
                          aria-label={`View memory: ${message.memory.title}`}
                          className="mb-2 block w-full overflow-hidden rounded-xl border border-white/10 text-left transition hover:border-pink-300/50"
                        >
                          <img
                            src={message.memory.image}
                            alt={message.memory.title}
                            className="h-36 w-full object-cover"
                          />
                          <span className="block truncate px-3 py-2 text-xs font-semibold">
                            {message.memory.title} · View memory
                          </span>
                        </button>
                      )}
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-gray-500">
                      <span>{formatMessageTime(message.createdAt)}</span>
                      {message.id === lastSeenOwnMessageId && (
                        <span className="font-semibold text-pink-300">
                          Seen
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {(historyError || socketError) && partner && (
          <p
            role="alert"
            className="fixed bottom-[7.5rem] z-20 mx-auto w-full max-w-md px-5 text-center text-xs text-rose-300"
          >
            {historyError || socketError}
          </p>
        )}

        {partner && (
          <form
            onSubmit={handleSend}
            className="fixed bottom-16 z-20 mx-auto flex w-full max-w-md items-center gap-2 border-t border-white/[0.08] bg-[#0d0d14]/90 px-4 py-3 backdrop-blur-2xl"
          >
            <input
              type="text"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              maxLength={2000}
              disabled={connectionState !== "connected"}
              placeholder={
                connectionState === "connected"
                  ? "Type a sweet message..."
                  : "Connecting to chat..."
              }
              className="min-w-0 flex-1 rounded-full border border-white/[0.08] bg-[#15151f] px-4 py-2.5 text-sm text-white transition-colors placeholder:text-gray-500 focus:border-pink-500/50 focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30 transition-all hover:from-pink-600 hover:to-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        )}

        {viewingMemory && (
          <div
            role="presentation"
            onClick={() => setViewingMemory(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="chat-memory-title"
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#15151f] shadow-2xl"
            >
              <button
                type="button"
                aria-label="Close memory"
                onClick={() => setViewingMemory(null)}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition hover:bg-black/80"
              >
                <X size={18} />
              </button>
              <img
                src={viewingMemory.image}
                alt={viewingMemory.title}
                className="max-h-[65vh] w-full bg-black object-contain"
              />
              <div className="space-y-2 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-300">
                  {viewingMemory.category} ·{" "}
                  {new Date(viewingMemory.date).toLocaleDateString()}
                </p>
                <h2
                  id="chat-memory-title"
                  className="text-lg font-bold text-white"
                >
                  {viewingMemory.title}
                </h2>
                {viewingMemory.description && (
                  <p className="text-sm leading-6 text-gray-300">
                    {viewingMemory.description}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        <BottomNav
          activeTab="chat"
          onTabChange={(tab) => router.push(`/${tab === "home" ? "" : tab}`)}
        />
      </main>
    </div>
  );
}
