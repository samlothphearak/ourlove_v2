"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  MessageCircle,
  Images,
  CalendarDays,
  ArrowUpRight,
  Sparkles,
  Gift,
  Moon,
  LogOut,
  Copy,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import AppHeader from "../components/layout/AppHeader";
import BottomNav, { type TabId } from "../components/layout/BottomNav";
import {
  ApiError,
  getHealth,
  getRecentMemories,
  type Memory,
} from "../lib/api";
import { AuthError, getCurrentUser, logout, type AuthUser } from "../lib/auth";
import {
  createPartnerInvitation,
  getPartnerStatus,
  type PartnerSummary,
} from "../lib/partner";

type FeatureColor = "pink" | "purple" | "blue" | "orange";

interface FeatureProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: FeatureColor;
  onClick: () => void;
}

const FEATURE_COLORS: Record<FeatureColor, string> = {
  pink: "bg-pink-500/15 text-pink-400 group-hover:bg-pink-500/25",
  purple: "bg-purple-500/15 text-purple-400 group-hover:bg-purple-500/25",
  blue: "bg-sky-500/15 text-sky-400 group-hover:bg-sky-500/25",
  orange: "bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25",
};

export default function Home() {
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<
    "checking" | "connected" | "offline"
  >("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [memoriesError, setMemoriesError] = useState("");
  const [partner, setPartner] = useState<PartnerSummary | null>(null);
  const [isLoadingPartner, setIsLoadingPartner] = useState(true);
  const [partnerError, setPartnerError] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [invitationExpiresAt, setInvitationExpiresAt] = useState("");
  const [invitationError, setInvitationError] = useState("");
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
  const [invitationCopied, setInvitationCopied] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((user) => {
        if (!active) return;
        setAuthUser(user);

        getRecentMemories()
          .then((recentMemories) => {
            if (active) setMemories(recentMemories);
          })
          .catch((error: unknown) => {
            if (!active) return;
            if (error instanceof ApiError && error.status === 401) {
              setAuthUser(null);
              router.replace("/login");
              return;
            }
            setMemoriesError(
              error instanceof Error
                ? error.message
                : "Unable to load recent memories.",
            );
          })
          .finally(() => {
            if (active) setIsLoadingMemories(false);
          });

        getPartnerStatus()
          .then((currentPartner) => {
            if (active) setPartner(currentPartner);
          })
          .catch((error: unknown) => {
            if (!active) return;
            if (error instanceof ApiError && error.status === 401) {
              setAuthUser(null);
              router.replace("/login");
              return;
            }
            setPartnerError(
              error instanceof Error
                ? error.message
                : "Unable to check your partner connection.",
            );
          })
          .finally(() => {
            if (active) setIsLoadingPartner(false);
          });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof AuthError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setSessionError(
          error instanceof Error
            ? error.message
            : "Unable to verify your session.",
        );
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });

    getHealth()
      .then((data) => {
        if (active) {
          setApiStatus(
            data?.database === "connected" ? "connected" : "offline",
          );
        }
      })
      .catch(() => {
        if (active) setApiStatus("offline");
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    }
  }

  async function handleCreateInvitation() {
    setInvitationError("");
    setIsCreatingInvitation(true);
    setInvitationCopied(false);
    try {
      const invitation = await createPartnerInvitation();
      setInvitationUrl(
        new URL(
          `/invite/${invitation.code}`,
          window.location.origin,
        ).toString(),
      );
      setInvitationExpiresAt(invitation.expiresAt);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthUser(null);
        router.replace("/login");
      } else {
        setInvitationError(
          error instanceof Error
            ? error.message
            : "Unable to create an invitation link.",
        );
      }
    } finally {
      setIsCreatingInvitation(false);
    }
  }

  async function handleCopyInvitation() {
    setInvitationError("");
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setInvitationCopied(true);
    } catch {
      setInvitationError(
        "Copy failed. Select the invitation link to copy it manually.",
      );
    }
  }

  function navigateToTab(tab: TabId) {
    router.push(tab === "home" ? "/" : `/${tab}`);
  }

  // --- Loading State ---
  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#09090f] text-sm text-gray-400">
        <div className="h-8 w-8 animate-pulse rounded-2xl bg-pink-500/20 flex items-center justify-center text-pink-400">
          <Heart size={18} fill="currentColor" />
        </div>
        <span>Checking your session...</span>
      </main>
    );
  }

  // --- Unauthenticated Fallback ---
  if (!authUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090f] px-4 text-center text-white">
        <section className="max-w-md w-full rounded-3xl border border-white/10 bg-[#15151f] p-8 shadow-2xl">
          <h1 className="text-xl font-semibold">Unable to open your space</h1>
          <p className="mt-3 text-sm text-gray-400">
            {sessionError || "Redirecting you to sign in..."}
          </p>
          <Link
            className="mt-6 inline-block rounded-full bg-pink-500/15 px-5 py-2.5 text-sm font-semibold text-pink-300 hover:bg-pink-500/25 transition-colors"
            href="/login"
          >
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex justify-center selection:bg-pink-500/30">
      <main className="w-full max-w-md min-h-screen flex flex-col relative bg-[#0d0d14] border-x border-white/[0.06] shadow-2xl">
        <AppHeader
          rightAction={
            <div className="flex items-center gap-2.5">
              <span className="hidden text-xs font-medium text-gray-400 sm:inline bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]">
                {authUser.name}
              </span>
              <Button
                aria-label="Sign out"
                className="p-2 rounded-xl text-gray-400 hover:text-pink-300 hover:bg-white/[0.06] transition-colors"
                onClick={handleLogout}
                variant="ghost"
              >
                <LogOut aria-hidden="true" size={18} />
              </Button>
            </div>
          }
        />

        {/* Logout Error Alert */}
        {logoutError && (
          <div
            className="mx-5 mt-4 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-300"
            role="alert"
          >
            {logoutError}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 px-5 pt-6 pb-28 space-y-8 overflow-y-auto">
          {/* Hero Welcome */}
          <section className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[11px] font-semibold tracking-wider uppercase">
              <Sparkles size={13} />
              <span>A Space Just For Two</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Welcome to <br />
              <span className="bg-gradient-to-r from-pink-400 via-rose-300 to-amber-200 bg-clip-text text-transparent">
                Our Little World.
              </span>
            </h1>

            <p className="text-sm text-gray-400 leading-relaxed">
              Every little moment with you deserves to be remembered.
            </p>
          </section>

          {/* Hero Love Story Card */}
          <section>
            <Card className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#1f1627] via-[#181524] to-[#13131d] border border-pink-500/20 shadow-xl shadow-pink-950/20">
              {/* Ambient Glows */}
              <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-pink-200 bg-white/[0.06] border border-white/[0.08] px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Your Love Story
                </span>
                <Heart
                  size={20}
                  className="text-pink-400"
                  fill="currentColor"
                />
              </div>

              {isLoadingPartner ? (
                <p className="relative z-10 py-10 text-center text-sm text-gray-400">
                  Checking your partner connection...
                </p>
              ) : partnerError ? (
                <p
                  className="relative z-10 my-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-center text-sm text-red-200"
                  role="alert"
                >
                  {partnerError}
                </p>
              ) : partner ? (
                <>
                  <div className="relative z-10 my-7 flex items-center justify-center gap-3">
                    <div className="rounded-full p-0.5 ring-2 ring-pink-400/40">
                      <Avatar name={authUser.name} size="md" />
                    </div>
                    <div className="z-10 -mx-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-lg shadow-pink-500/30">
                      <Heart size={15} fill="currentColor" />
                    </div>
                    <div className="rounded-full p-0.5 ring-2 ring-pink-400/40">
                      <Avatar name={partner.name} size="md" />
                    </div>
                  </div>

                  <div className="relative z-10 space-y-1 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-pink-300/80">
                      Connected with {partner.name}
                    </div>
                    <div className="py-1 text-5xl font-light tracking-tight text-white">
                      ∞
                    </div>
                    <p className="text-xs text-gray-400">
                      Your story is still being written.
                    </p>
                  </div>
                </>
              ) : (
                <div className="relative z-10 my-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-300">
                    <UserRound size={22} />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Your partner isn&apos;t connected yet
                  </h2>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-gray-400">
                    Create a private invitation link and send it to your partner
                    to connect your accounts.
                  </p>

                  {invitationError && (
                    <p
                      className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
                      role="alert"
                    >
                      {invitationError}
                    </p>
                  )}

                  {invitationUrl ? (
                    <div className="mt-5 space-y-3">
                      <input
                        aria-label="Partner invitation link"
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-pink-400"
                        onFocus={(event) => event.currentTarget.select()}
                        readOnly
                        value={invitationUrl}
                      />
                      <Button
                        className="inline-flex items-center gap-2"
                        onClick={handleCopyInvitation}
                        variant="secondary"
                      >
                        <Copy size={15} />
                        {invitationCopied ? "Link copied" : "Copy invite link"}
                      </Button>
                      <p className="text-xs text-gray-500">
                        Expires{" "}
                        {new Date(invitationExpiresAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </p>
                    </div>
                  ) : (
                    <Button
                      className="mt-5"
                      disabled={isCreatingInvitation}
                      onClick={handleCreateInvitation}
                    >
                      {isCreatingInvitation
                        ? "Creating link..."
                        : "Create invitation link"}
                    </Button>
                  )}
                </div>
              )}

              {partner && (
                <div className="relative z-10 mt-6 space-y-1 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-pink-300/80">
                    Every day, a new memory
                  </div>
                  <p className="text-xs text-gray-400">Always together</p>
                </div>
              )}

              <div className="relative z-10 mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs font-medium text-pink-200/80">
                <span>
                  {partner ? "Always together" : "A space just for two"}
                </span>
                <Sparkles size={15} className="text-pink-400" />
              </div>
            </Card>
          </section>

          {/* Quick Actions Grid */}
          <section className="space-y-4">
            <SectionTitle
              title="Little things we share"
              subtitle="YOUR SPACE"
            />

            <div className="grid grid-cols-2 gap-3.5">
              <Feature
                icon={MessageCircle}
                title="Our Chat"
                description="Talk anytime"
                color="pink"
                onClick={() => navigateToTab("chat")}
              />
              <Feature
                icon={Images}
                title="Memories"
                description="Save moments"
                color="purple"
                onClick={() => navigateToTab("memories")}
              />
              <Feature
                icon={CalendarDays}
                title="Our Days"
                description="Special dates"
                color="blue"
                onClick={() => navigateToTab("days")}
              />
              <Feature
                icon={Gift}
                title="Love Notes"
                description="Little surprises"
                color="orange"
                onClick={() => navigateToTab("us")}
              />
            </div>
          </section>

          {/* Recent Memories */}
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <SectionTitle
                title="Recent memories"
                subtitle="CAPTURED FOREVER"
              />
              <Button
                variant="ghost"
                onClick={() => navigateToTab("memories")}
                className="text-xs font-semibold text-pink-300 hover:text-pink-200 flex items-center gap-1"
              >
                See all <ArrowUpRight size={15} />
              </Button>
            </div>

            <div className="space-y-3">
              {isLoadingMemories ? (
                <p className="rounded-2xl bg-[#15151f] px-4 py-5 text-sm text-gray-400">
                  Loading recent memories...
                </p>
              ) : memoriesError ? (
                <p
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-5 text-sm text-red-300"
                  role="alert"
                >
                  {memoriesError}
                </p>
              ) : memories.length === 0 ? (
                <p className="rounded-2xl bg-[#15151f] px-4 py-5 text-sm text-gray-400">
                  No memories saved yet.
                </p>
              ) : (
                memories.map((memory) => (
                  <article
                    key={memory.id}
                    onClick={() => navigateToTab("memories")}
                    className="group flex items-center gap-3.5 p-2.5 rounded-2xl bg-[#15151f] border border-white/[0.07] hover:border-pink-500/30 hover:bg-[#191926] transition-all cursor-pointer"
                  >
                    <img
                      src={memory.image}
                      alt={memory.title}
                      loading="lazy"
                      className="w-20 h-20 rounded-xl object-cover shrink-0 group-hover:scale-[1.03] transition-transform duration-300"
                    />

                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-pink-300 bg-pink-500/15 px-2 py-0.5 rounded-md mb-1">
                        {memory.type}
                      </span>
                      <h3 className="font-semibold text-sm text-white truncate">
                        {memory.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(memory.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="pr-2 text-gray-600 group-hover:text-pink-400 transition-colors">
                      <Heart size={18} />
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Quote Card */}
          <section className="rounded-3xl p-6 bg-[#15151f]/80 border border-white/[0.06] text-center space-y-2.5">
            <div className="w-9 h-9 mx-auto rounded-full bg-pink-500/10 text-pink-300 flex items-center justify-center">
              <Moon size={17} />
            </div>
            <p className="text-sm font-medium italic text-gray-200">
              &ldquo;In a world full of people, I&apos;d still choose
              you.&rdquo;
            </p>
            <span className="block text-[10px] font-bold tracking-widest uppercase text-pink-400/80">
              A little reminder of us ♡
            </span>
          </section>

          {/* API Health Footer */}
          <footer className="pt-2 pb-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
            <span
              className={`w-2 h-2 rounded-full ${
                apiStatus === "connected"
                  ? "bg-emerald-400"
                  : apiStatus === "checking"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-rose-500"
              }`}
            />
            <span>
              OurLove API:{" "}
              {apiStatus === "connected"
                ? "Connected"
                : apiStatus === "checking"
                  ? "Checking..."
                  : "Offline"}
            </span>
          </footer>
        </div>

        <BottomNav activeTab="home" onTabChange={navigateToTab} />
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
  color,
  onClick,
}: FeatureProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left p-4 rounded-2xl bg-[#15151f] border border-white/[0.07] hover:border-pink-500/30 hover:bg-[#191926] transition-all flex flex-col justify-between"
    >
      <div className="flex items-start justify-between w-full mb-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${FEATURE_COLORS[color]}`}
        >
          <Icon size={20} />
        </div>
        <ArrowUpRight
          size={16}
          className="text-gray-600 group-hover:text-pink-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
        />
      </div>

      <div>
        <div className="font-semibold text-sm text-white">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
    </button>
  );
}
