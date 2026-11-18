"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Images,
  Calendar,
  Heart,
  X,
  Sparkles,
  MessageCircle,
  Upload,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import AppHeader from "../../components/layout/AppHeader";
import BottomNav from "../../components/layout/BottomNav";
import { getCurrentUser, AuthError, type AuthUser } from "../../lib/auth";
import {
  ApiError,
  createMemory,
  getMemories,
  setMemoryLiked,
  type MemoryRecord,
} from "../../lib/api";

const CATEGORIES = ["Travel", "Dates", "Outdoors", "Together"];
const FILTER_CATEGORIES = ["All", ...CATEGORIES];

function formatMemoryDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default function MemoriesPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [memoriesError, setMemoriesError] = useState("");
  const [memoryReloadToken, setMemoryReloadToken] = useState(0);
  const [activeMemory, setActiveMemory] = useState<MemoryRecord | null>(null);
  const [activeMemoryError, setActiveMemoryError] = useState("");
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memoryFormError, setMemoryFormError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Dates");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [newDescription, setNewDescription] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const user = await getCurrentUser();
        if (active) {
          setAuthUser(user);
          setSessionError("");
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof AuthError && error.status === 401) {
          router.replace("/login");
        } else {
          setSessionError(
            error instanceof Error
              ? error.message
              : "Unable to verify your sign-in.",
          );
        }
      } finally {
        if (active) setIsCheckingSession(false);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [router, sessionAttempt]);

  useEffect(() => {
    if (!authUser) return;
    let active = true;

    async function loadMemories() {
      setIsLoadingMemories(true);
      setMemoriesError("");
      try {
        const data = await getMemories();
        if (active) setMemories(data);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setAuthUser(null);
          router.replace("/login");
        } else {
          setMemoriesError(
            error instanceof Error
              ? error.message
              : "Unable to load your memories.",
          );
        }
      } finally {
        if (active) setIsLoadingMemories(false);
      }
    }

    void loadMemories();
    return () => {
      active = false;
    };
  }, [authUser, memoryReloadToken, router]);

  useEffect(() => {
    if (!imagePreviewUrl) return;
    return () => URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setMemoryFormError("");
    if (!file) {
      setNewImageFile(null);
      setImagePreviewUrl("");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMemoryFormError("Choose a JPEG, PNG, or WebP photo.");
      setNewImageFile(null);
      setImagePreviewUrl("");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMemoryFormError("Photos must be 5 MB or smaller.");
      setNewImageFile(null);
      setImagePreviewUrl("");
      event.target.value = "";
      return;
    }

    setNewImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function resetMemoryForm() {
    setNewTitle("");
    setNewCategory("Dates");
    setNewImageFile(null);
    setImagePreviewUrl("");
    setNewDescription("");
    setMemoryFormError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function closeAddMemory() {
    if (isSavingMemory) return;
    setIsAddingMemory(false);
    resetMemoryForm();
  }

  async function handleToggleLike() {
    if (!activeMemory || isUpdatingLike) return;
    setActiveMemoryError("");
    setIsUpdatingLike(true);
    try {
      const updatedMemory = await setMemoryLiked(
        activeMemory.id,
        !activeMemory.likedByMe,
      );
      setMemories((current) =>
        current.map((memory) =>
          memory.id === updatedMemory.id ? updatedMemory : memory,
        ),
      );
      setActiveMemory((current) =>
        current?.id === updatedMemory.id ? updatedMemory : current,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
      } else {
        setActiveMemoryError(
          error instanceof Error
            ? error.message
            : "Unable to update this memory.",
        );
      }
    } finally {
      setIsUpdatingLike(false);
    }
  }

  async function handleCreateMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemoryFormError("");
    if (!newImageFile) {
      setMemoryFormError("Choose a photo for this memory.");
      return;
    }

    setIsSavingMemory(true);
    try {
      const createdMemory = await createMemory({
        title: newTitle.trim(),
        category: newCategory,
        description: newDescription.trim(),
        image: newImageFile,
      });
      setMemories((current) => [createdMemory, ...current]);
      setSelectedCategory("All");
      setIsAddingMemory(false);
      resetMemoryForm();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
      } else {
        setMemoryFormError(
          error instanceof Error
            ? error.message
            : "Unable to save this memory.",
        );
      }
    } finally {
      setIsSavingMemory(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#09090f] text-sm text-gray-400">
        <div className="h-8 w-8 animate-pulse rounded-2xl bg-pink-500/20 flex items-center justify-center text-pink-400">
          <Heart size={18} fill="currentColor" />
        </div>
        <span>Loading memories...</span>
      </main>
    );
  }

  if (!authUser) {
    if (!sessionError) return null;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09090f] px-5 text-center text-sm text-gray-300">
        <p role="alert">{sessionError}</p>
        <button
          type="button"
          onClick={() => {
            setIsCheckingSession(true);
            setSessionAttempt((attempt) => attempt + 1);
          }}
          className="rounded-xl bg-pink-500 px-4 py-2.5 font-semibold text-white hover:bg-pink-400"
        >
          Try again
        </button>
      </main>
    );
  }

  const filteredMemories =
    selectedCategory === "All"
      ? memories
      : memories.filter((memory) => memory.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex justify-center selection:bg-pink-500/30">
      <main className="w-full max-w-md min-h-screen flex flex-col relative bg-[#0d0d14] border-x border-white/[0.06] shadow-2xl pb-32">
        <AppHeader
          title="Memories"
          caption="CAPTURED FOREVER"
          brandIcon={Images}
          rightAction={
            <button
              type="button"
              onClick={() => {
                setMemoryFormError("");
                setIsAddingMemory(true);
              }}
              aria-label="Add memory"
              className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 hover:bg-pink-500/25 flex items-center justify-center transition-all shadow-sm active:scale-95"
            >
              <Plus size={18} />
            </button>
          }
        />

        <div className="content px-5 pt-6 space-y-6">
          <div className="px-1">
            <p className="text-xs font-semibold tracking-[0.16em] text-pink-300/80">
              YOUR STORY, ONE MOMENT AT A TIME
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Little moments, kept close
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
              Moments from you and your partner, all together in one place.
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selectedCategory === cat}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-950/30"
                    : "bg-[#15151f] text-gray-300 border border-white/[0.08] hover:bg-white/[0.04]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-400">
              {isLoadingMemories
                ? "Loading your collection..."
                : `${filteredMemories.length} ${
                    filteredMemories.length === 1 ? "memory" : "memories"
                  }`}
            </p>
            {memories.length > 0 && (
              <button
                type="button"
                onClick={() => setMemoryReloadToken((token) => token + 1)}
                disabled={isLoadingMemories}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  size={13}
                  className={isLoadingMemories ? "animate-spin" : ""}
                />
                Refresh
              </button>
            )}
          </div>

          {memoriesError ? (
            <div
              role="alert"
              className="space-y-3 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-5 text-sm text-red-200"
            >
              <p>{memoriesError}</p>
              <button
                type="button"
                onClick={() => setMemoryReloadToken((token) => token + 1)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.1]"
              >
                <RefreshCw size={13} />
                Try again
              </button>
            </div>
          ) : isLoadingMemories ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.06] bg-[#15151f]/70 py-16 text-sm text-gray-400">
              <LoaderCircle size={22} className="animate-spin text-pink-300" />
              Loading your memories...
            </div>
          ) : filteredMemories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3.5">
              {filteredMemories.map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  onClick={() => {
                    setActiveMemoryError("");
                    setActiveMemory(memory);
                  }}
                  aria-label={`View memory: ${memory.title}`}
                  className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#15151f] text-left shadow-lg transition-all hover:border-pink-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
                >
                  <img
                    src={memory.image}
                    alt=""
                    loading="lazy"
                    className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#0d0d14] via-[#0d0d14]/40 to-transparent p-3.5 text-white">
                    <span className="mb-1 inline-block self-start rounded-md border border-pink-500/30 bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-300">
                      {memory.category}
                    </span>
                    <h2 className="text-sm font-semibold leading-tight text-white">
                      {memory.title}
                    </h2>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                      <Calendar size={12} className="text-pink-400" />
                      {formatMemoryDate(memory.date)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/[0.1] bg-[#15151f]/60 px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-300">
                <Images size={22} />
              </div>
              <h2 className="mt-4 text-base font-semibold text-white">
                {memories.length === 0
                  ? "Your story starts here"
                  : `No ${selectedCategory.toLowerCase()} memories yet`}
              </h2>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-gray-400">
                {memories.length === 0
                  ? "Save a photo and a few words to keep a favorite moment close."
                  : "Try another category or add a memory to this collection."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMemoryFormError("");
                  setIsAddingMemory(true);
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-pink-950/20 transition hover:bg-pink-400"
              >
                <Plus size={15} />
                Add a memory
              </button>
            </div>
          )}
        </div>

        {isAddingMemory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-memory-title"
              className="w-full max-w-sm bg-[#15151f] border border-white/[0.12] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                  <h2
                    id="add-memory-title"
                    className="flex items-center gap-2 text-base font-semibold text-white"
                  >
                    <Sparkles size={16} className="text-pink-300" />
                    Add a memory
                  </h2>
                  <p className="mt-1 text-xs text-gray-400">
                    Keep a favorite moment close.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAddMemory}
                  disabled={isSavingMemory}
                  aria-label="Close add memory"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-gray-400 transition-colors hover:text-white disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <form
                onSubmit={handleCreateMemory}
                className="space-y-4 overflow-y-auto p-5"
              >
                {memoryFormError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-200"
                  >
                    {memoryFormError}
                  </p>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="memory-image"
                    className="text-xs font-semibold text-gray-300"
                  >
                    Photo
                  </label>
                  <label
                    htmlFor="memory-image"
                    className="relative flex h-36 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/[0.15] bg-[#0d0d14] transition-colors hover:border-pink-500/50"
                  >
                    {imagePreviewUrl ? (
                      <img
                        src={imagePreviewUrl}
                        alt="Selected memory preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <Upload size={23} className="mb-2 text-pink-300" />
                        <p className="text-xs font-medium">
                          Choose a photo from your device
                        </p>
                        <p className="mt-1 text-[10px] text-gray-500">
                          JPEG, PNG, or WebP · up to 5 MB
                        </p>
                      </div>
                    )}
                    <input
                      ref={imageInputRef}
                      id="memory-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="memory-title"
                    className="text-xs font-semibold text-gray-300"
                  >
                    Title
                  </label>
                  <input
                    id="memory-title"
                    type="text"
                    required
                    maxLength={120}
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="e.g. Sunset picnic at the park"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0d0d14] px-3.5 py-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-pink-400/60 focus:ring-4 focus:ring-pink-500/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="memory-category"
                    className="text-xs font-semibold text-gray-300"
                  >
                    Category
                  </label>
                  <select
                    id="memory-category"
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0d0d14] px-3.5 py-3 text-sm text-white outline-none transition focus:border-pink-400/60"
                  >
                    {CATEGORIES.map((category) => (
                      <option
                        key={category}
                        value={category}
                        className="bg-[#15151f] text-white"
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="memory-description"
                    className="text-xs font-semibold text-gray-300"
                  >
                    A little note{" "}
                    <span className="font-normal text-gray-500">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="memory-description"
                    rows={3}
                    maxLength={1000}
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                    placeholder="What made this moment special?"
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#0d0d14] p-3.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-pink-400/60 focus:ring-4 focus:ring-pink-500/10"
                  />
                  <p className="text-right text-[10px] text-gray-500">
                    {newDescription.length}/1000
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeAddMemory}
                    disabled={isSavingMemory}
                    className="flex-1 rounded-xl bg-white/[0.05] py-3 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMemory}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-xs font-semibold text-white shadow-md shadow-pink-950/30 transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingMemory && (
                      <LoaderCircle size={14} className="animate-spin" />
                    )}
                    {isSavingMemory ? "Saving..." : "Save memory"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeMemory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="memory-details-title"
              className="w-full max-w-sm bg-[#15151f] border border-white/[0.12] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="relative w-full h-72 sm:h-80 shrink-0 bg-black flex items-center justify-center overflow-hidden">
                <img
                  src={activeMemory.image}
                  alt={activeMemory.title}
                  className="w-full h-full object-cover shadow-inner"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#15151f] via-transparent to-black/30" />

                <button
                  type="button"
                  onClick={() => setActiveMemory(null)}
                  aria-label="Close memory details"
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 flex items-center justify-center hover:bg-black/80 transition-colors shadow-md"
                >
                  <X size={18} />
                </button>

                <div className="absolute bottom-4 left-5 right-5">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-pink-300 bg-pink-500/20 px-2.5 py-1 rounded-md mb-1.5 border border-pink-500/30">
                    {activeMemory.category}
                  </span>
                  <h2
                    id="memory-details-title"
                    className="text-xl font-bold text-white leading-tight"
                  >
                    {activeMemory.title}
                  </h2>
                </div>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="flex items-center justify-between text-xs text-gray-400 border-b border-white/[0.06] pb-3">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-pink-400" />{" "}
                    {formatMemoryDate(activeMemory.date)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-pink-300">
                    <Sparkles size={13} /> Saved to your memories
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Memory Note
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-200 leading-relaxed italic bg-[#0d0d14] p-3.5 rounded-2xl border border-white/[0.05]">
                    {activeMemory.description
                      ? `“${activeMemory.description}”`
                      : "No note added to this memory yet."}
                  </p>
                </div>

                {activeMemoryError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200"
                  >
                    {activeMemoryError}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleToggleLike}
                    disabled={isUpdatingLike}
                    aria-pressed={activeMemory.likedByMe}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border transition-all ${
                      activeMemory.likedByMe
                        ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                        : "bg-[#0d0d14] border-white/[0.08] text-gray-300 hover:bg-white/[0.04]"
                    } disabled:cursor-wait disabled:opacity-60`}
                  >
                    <Heart
                      size={16}
                      fill={activeMemory.likedByMe ? "currentColor" : "none"}
                      className={
                        activeMemory.likedByMe
                          ? "text-pink-400"
                          : "text-gray-400"
                      }
                    />
                    <span className="text-xs font-semibold">
                      {activeMemory.likesCount}{" "}
                      {activeMemory.likesCount === 1 ? "Love" : "Loves"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/chat?memoryId=${encodeURIComponent(activeMemory.id)}`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-semibold shadow-md shadow-pink-950/30 hover:opacity-95 transition-all"
                  >
                    <MessageCircle size={14} /> Chat about this
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <BottomNav
          activeTab="memories"
          onTabChange={(tab) => router.push(`/${tab === "home" ? "" : tab}`)}
        />
      </main>
    </div>
  );
}
