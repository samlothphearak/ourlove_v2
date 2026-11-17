"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarHeart,
  Check,
  Copy,
  Gift,
  Heart,
  HeartHandshake,
  LogOut,
  Pencil,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";

import Avatar from "../../components/ui/Avatar";
import AppHeader from "../../components/layout/AppHeader";
import BottomNav from "../../components/layout/BottomNav";
import Button from "../../components/ui/Button";
import { ApiError } from "../../lib/api";
import {
  AuthError,
  getCurrentUser,
  logout,
  type AuthUser,
} from "../../lib/auth";
import {
  createPartnerInvitation,
  getPartnerPageData,
  updatePartnerProfile,
  type PartnerPageData,
  type PartnerProfileUpdate,
} from "../../lib/partner";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function getDaysTogether(date: string | null) {
  if (!date) return null;

  const start = Date.parse(`${date}T00:00:00.000Z`);
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.floor((todayUtc - start) / 86_400_000);
}

export default function UsPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profileData, setProfileData] = useState<PartnerPageData | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [invitationExpiresAt, setInvitationExpiresAt] = useState("");
  const [invitationError, setInvitationError] = useState("");
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
  const [invitationCopied, setInvitationCopied] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const user = await getCurrentUser();
        if (!active) return;
        setAuthUser(user);

        const data = await getPartnerPageData();
        if (active) setProfileData(data);
      } catch (error) {
        if (!active) return;
        if (
          (error instanceof AuthError || error instanceof ApiError) &&
          error.status === 401
        ) {
          router.replace("/login");
        } else {
          setProfileError(
            error instanceof Error
              ? error.message
              : "Unable to load your couple profile.",
          );
        }
      } finally {
        if (active) setIsCheckingSession(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  async function saveProfile(updates: PartnerProfileUpdate) {
    setProfileError("");
    setIsSavingProfile(true);
    try {
      const data = await updatePartnerProfile(updates);
      setProfileData(data);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
      } else {
        setProfileError(
          error instanceof Error
            ? error.message
            : "Unable to save your shared profile.",
        );
      }
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSaveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await saveProfile({ loveNote: draftNote })) {
      setIsEditingNote(false);
    }
  }

  async function handleSaveDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await saveProfile({ anniversaryDate: draftDate || null })) {
      setIsEditingDate(false);
    }
  }

  async function handleClearDate() {
    if (await saveProfile({ anniversaryDate: null })) {
      setDraftDate("");
      setIsEditingDate(false);
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

  async function handleLogout() {
    setLogoutError("");
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#09090f] text-sm text-gray-400">
        <div className="flex h-8 w-8 items-center justify-center animate-pulse rounded-2xl bg-pink-500/20 text-pink-400">
          <Heart size={18} fill="currentColor" />
        </div>
        <span>Loading couple profile...</span>
      </main>
    );
  }

  if (!authUser) {
    if (!profileError) return null;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090f] px-5 text-center text-sm text-red-200">
        {profileError}
      </main>
    );
  }

  const partner = profileData?.partner ?? null;
  const hasProfileData = profileData !== null;
  const daysTogether = getDaysTogether(profileData?.anniversaryDate ?? null);

  return (
    <div className="flex min-h-screen justify-center bg-[#09090f] text-white selection:bg-pink-500/30">
      <main className="relative flex min-h-screen w-full max-w-md flex-col border-x border-white/[0.06] bg-[#0d0d14] pb-32 shadow-2xl">
        <AppHeader
          title="Us"
          caption="COUPLE SETTINGS & PROFILE"
          brandIcon={UserRound}
        />

        <div className="content space-y-6 px-5 pt-6">
          {profileError && (
            <p
              className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {profileError}
            </p>
          )}

          <section className="relative space-y-4 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#15151f] p-6 text-center shadow-xl">
            <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-pink-500/10 blur-2xl" />

            {profileData ? (
              <>
                <div className="relative z-10 flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="rounded-full p-0.5 ring-2 ring-pink-400/40">
                      <Avatar name={authUser.name} size="lg" />
                    </div>
                    <span className="mt-2 block text-xs font-semibold text-gray-200">
                      {authUser.name}
                    </span>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30">
                    <Heart size={16} fill="currentColor" />
                  </div>

                  <div className="text-center">
                    {partner ? (
                      <div className="rounded-full p-0.5 ring-2 ring-pink-400/40">
                        <Avatar name={partner.name} size="lg" />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/20 text-gray-500">
                        <UserRound size={22} />
                      </div>
                    )}
                    <span className="mt-2 block text-xs font-semibold text-gray-200">
                      {partner?.name ?? "Not connected"}
                    </span>
                  </div>
                </div>

                <div
                  className={`relative z-10 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-medium ${
                    partner
                      ? "border-pink-500/20 bg-pink-500/10 text-pink-300"
                      : "border-white/10 bg-white/[0.04] text-gray-400"
                  }`}
                >
                  <Sparkles size={13} />
                  {partner ? "Connected" : "Not connected"}
                </div>

                <div className="relative z-10 grid grid-cols-2 border-t border-white/[0.06] pt-3">
                  <div>
                    <div className="text-base font-bold text-white">
                      {daysTogether === null
                        ? "—"
                        : daysTogether >= 0
                          ? daysTogether
                          : Math.abs(daysTogether)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">
                      {daysTogether === null
                        ? "Days together"
                        : daysTogether >= 0
                          ? "Days together"
                          : "Days until date"}
                    </div>
                  </div>
                  <div className="border-l border-white/[0.06]">
                    <div className="text-base font-bold text-pink-300">
                      {profileData.memoriesCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">
                      Your memories
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="relative z-10 py-8 text-sm text-gray-400">
                Your couple profile could not be loaded.
              </p>
            )}
          </section>

          <section className="relative space-y-3 overflow-hidden rounded-3xl border border-pink-500/20 bg-gradient-to-br from-[#1f1627] via-[#181524] to-[#13131d] p-5 text-white shadow-lg">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/15 blur-2xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-pink-200">
                <Gift size={18} className="text-pink-400" />
                Shared Love Note
              </div>
              {partner && !isEditingNote && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftNote(profileData?.loveNote ?? "");
                    setIsEditingNote(true);
                  }}
                  aria-label="Edit shared love note"
                  className="rounded-lg bg-white/[0.05] p-1.5 text-pink-300 transition-colors hover:bg-white/[0.1]"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>

            {!hasProfileData ? (
              <p className="relative z-10 text-xs leading-relaxed text-gray-400">
                Shared profile details are currently unavailable.
              </p>
            ) : !partner ? (
              <p className="relative z-10 text-xs leading-relaxed text-gray-400">
                Connect your partner to create a note you can both see and edit.
              </p>
            ) : isEditingNote ? (
              <form
                onSubmit={handleSaveNote}
                className="relative z-10 space-y-2"
              >
                <textarea
                  rows={3}
                  maxLength={500}
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                  className="w-full rounded-xl border border-pink-500/30 bg-black/30 p-2.5 text-xs text-white placeholder-gray-500 focus:border-pink-400 focus:outline-none"
                  placeholder="Write something sweet for both of you..."
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">
                    {draftNote.length}/500
                  </span>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      disabled={isSavingProfile}
                      onClick={() => setIsEditingNote(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs"
                      disabled={isSavingProfile}
                    >
                      <Send size={12} />
                      {isSavingProfile ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <p className="relative z-10 text-xs italic leading-relaxed text-gray-300">
                {profileData?.loveNote
                  ? `“${profileData.loveNote}”`
                  : "No shared note yet. Add something sweet for both of you."}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-gray-400">
              Relationship details
            </h3>

            <div className="overflow-hidden divide-y divide-white/[0.06] rounded-3xl border border-white/[0.08] bg-[#15151f]">
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 text-sm font-medium text-gray-200">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                      <CalendarHeart size={18} />
                    </div>
                    <div>
                      <div>Anniversary Date</div>
                      <div className="text-[11px] font-normal text-gray-400">
                        {profileData?.anniversaryDate
                          ? formatDate(profileData.anniversaryDate)
                          : "Not set"}
                      </div>
                    </div>
                  </div>

                  {partner && !isEditingDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftDate(profileData?.anniversaryDate ?? "");
                        setIsEditingDate(true);
                      }}
                      className="text-xs font-semibold text-pink-400 hover:text-pink-300"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {partner && isEditingDate && (
                  <form onSubmit={handleSaveDate} className="space-y-3">
                    <input
                      aria-label="Anniversary date"
                      type="date"
                      value={draftDate}
                      onChange={(event) => setDraftDate(event.target.value)}
                      className="w-full rounded-lg border border-pink-500/30 bg-[#0d0d14] px-3 py-2 text-sm text-white focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      {profileData?.anniversaryDate && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-3 py-1.5 text-xs"
                          disabled={isSavingProfile}
                          onClick={handleClearDate}
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        disabled={isSavingProfile}
                        onClick={() => setIsEditingDate(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="px-3 py-1.5 text-xs"
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </form>
                )}

                {!hasProfileData ? (
                  <p className="pl-12 text-xs text-gray-500">
                    Shared profile details are currently unavailable.
                  </p>
                ) : !partner ? (
                  <p className="pl-12 text-xs text-gray-500">
                    Connect your partner to set a shared anniversary.
                  </p>
                ) : null}
              </div>

              {hasProfileData && !partner && (
                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-3.5 text-sm font-medium text-gray-200">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
                      <HeartHandshake size={18} />
                    </div>
                    Invite your partner
                  </div>
                  <p className="pl-12 text-xs leading-relaxed text-gray-400">
                    Create a one-use link to connect your accounts. It expires
                    after seven days.
                  </p>

                  {invitationError && (
                    <p
                      className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-200"
                      role="alert"
                    >
                      {invitationError}
                    </p>
                  )}

                  {invitationUrl ? (
                    <div className="space-y-3">
                      <input
                        aria-label="Partner invitation link"
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-pink-400"
                        onFocus={(event) => event.currentTarget.select()}
                        readOnly
                        value={invitationUrl}
                      />
                      <Button
                        type="button"
                        className="inline-flex items-center gap-2"
                        onClick={handleCopyInvitation}
                        variant="secondary"
                      >
                        {invitationCopied ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )}
                        {invitationCopied ? "Link copied" : "Copy invite link"}
                      </Button>
                      <p className="text-xs text-gray-500">
                        Expires {formatDate(invitationExpiresAt.slice(0, 10))}
                      </p>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="ml-12"
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
            </div>
          </section>

          {logoutError && (
            <p
              className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {logoutError}
            </p>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-300 transition-all hover:border-red-500/30 hover:bg-red-500/15 disabled:opacity-50"
          >
            <LogOut size={17} />
            {isLoggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>

        <BottomNav
          activeTab="us"
          onTabChange={(tab) => router.push(`/${tab === "home" ? "" : tab}`)}
        />
      </main>
    </div>
  );
}
