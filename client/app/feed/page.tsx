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
  ArrowUpRight,
  Check,
  Globe2,
  Heart,
  ImagePlus,
  Link2,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  UsersRound,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  X,
} from "lucide-react";

import Avatar from "../../components/ui/Avatar";
import AppHeader from "../../components/layout/AppHeader";
import BottomNav, { type TabId } from "../../components/layout/BottomNav";
import { AuthError, getCurrentUser, type AuthUser } from "../../lib/auth";
import {
  acceptFriendRequest,
  addPostComment,
  ApiError,
  createFeedPost,
  deleteFriendRequest,
  getFeed,
  getFeedPost,
  getFriends,
  getPostComments,
  removeFriend,
  searchFriends,
  sendFriendRequest,
  setPostLiked,
  shareFeedPost,
  type FeedPost,
  type FriendData,
  type FriendSearchResult,
  type PostComment,
  type PostVisibility,
} from "../../lib/api";

type FeedSection = "feed" | "friends";

const AUDIENCE_LABELS: Record<PostVisibility, string> = {
  public: "Public",
  friends: "Friends",
  private: "Only me",
};

function formatPostDate(date: string) {
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year:
      new Date(date).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }).format(new Date(date));
}

function getRelationshipId(data: FriendData, userId: string, relation: string) {
  const list =
    relation === "incoming"
      ? data.incoming
      : relation === "outgoing"
        ? data.outgoing
        : data.friends;
  return list.find((item) => item.user.id === userId)?.id;
}

export default function FeedPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const [section, setSection] = useState<FeedSection>("feed");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [reloadFeed, setReloadFeed] = useState(0);
  const [linkedPostError, setLinkedPostError] = useState("");

  const [isComposing, setIsComposing] = useState(false);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [postFormError, setPostFormError] = useState("");
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [postImage, setPostImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [busyPostIds, setBusyPostIds] = useState<Set<string>>(new Set());
  const [postActionError, setPostActionError] = useState("");
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [commentsLoadingId, setCommentsLoadingId] = useState<string | null>(
    null,
  );

  const [friendData, setFriendData] = useState<FriendData>({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [friendMessage, setFriendMessage] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState<FriendSearchResult[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [friendBusyUserId, setFriendBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (active) {
          setAuthUser(user);
          setSessionError("");
        }
      })
      .catch((error: unknown) => {
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
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authUser) return;
    let active = true;

    async function loadFeed() {
      setIsLoadingFeed(true);
      setFeedError("");
      setLinkedPostError("");
      try {
        const linkedPostId =
          typeof window === "undefined"
            ? null
            : new URLSearchParams(window.location.search).get("post");
        const [feedPage, linkedPost] = await Promise.all([
          getFeed(),
          linkedPostId
            ? getFeedPost(linkedPostId).catch((error: unknown) => {
                if (active) {
                  setLinkedPostError(
                    error instanceof Error
                      ? error.message
                      : "This post is unavailable to your account.",
                  );
                }
                return null;
              })
            : Promise.resolve(null),
        ]);
        if (!active) return;
        const feedPosts = linkedPost
          ? [
              linkedPost,
              ...feedPage.posts.filter((post) => post.id !== linkedPost.id),
            ]
          : feedPage.posts;
        setPosts(feedPosts);
        setNextCursor(feedPage.nextCursor);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
        } else {
          setFeedError(
            error instanceof Error ? error.message : "Unable to load the feed.",
          );
        }
      } finally {
        if (active) setIsLoadingFeed(false);
      }
    }

    void loadFeed();
    return () => {
      active = false;
    };
  }, [authUser, reloadFeed, router]);

  useEffect(() => {
    if (!imagePreviewUrl) return;
    return () => URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (!authUser || section !== "friends") return;
    let active = true;
    getFriends()
      .then((data) => {
        if (active) setFriendData(data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
        } else {
          setFriendError(
            error instanceof Error
              ? error.message
              : "Unable to load your friends.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoadingFriends(false);
      });
    return () => {
      active = false;
    };
  }, [authUser, section, router]);

  function navigateToTab(tab: TabId) {
    router.push(tab === "home" ? "/" : `/${tab}`);
  }

  function redirectIfUnauthorized(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      router.replace("/login");
      return true;
    }
    return false;
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPostFormError("");
    if (!file) {
      setPostImage(null);
      setImagePreviewUrl("");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPostFormError("Choose a JPEG, PNG, or WebP photo.");
      setPostImage(null);
      setImagePreviewUrl("");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPostFormError("Photos must be 5 MB or smaller.");
      setPostImage(null);
      setImagePreviewUrl("");
      event.target.value = "";
      return;
    }
    setPostImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function resetPostForm() {
    setCaption("");
    setVisibility("public");
    setPostImage(null);
    setImagePreviewUrl("");
    setPostFormError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostFormError("");
    if (!postImage) {
      setPostFormError("Choose a photo to share.");
      return;
    }
    setIsSavingPost(true);
    try {
      const post = await createFeedPost({
        image: postImage,
        caption: caption.trim(),
        visibility,
      });
      setPosts((current) => [
        post,
        ...current.filter((item) => item.id !== post.id),
      ]);
      setIsComposing(false);
      resetPostForm();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
      } else {
        setPostFormError(
          error instanceof Error
            ? error.message
            : "Unable to create your post.",
        );
      }
    } finally {
      setIsSavingPost(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setFeedError("");
    try {
      const page = await getFeed(nextCursor);
      setPosts((current) => {
        const existingIds = new Set(current.map((post) => post.id));
        return [
          ...current,
          ...page.posts.filter((post) => !existingIds.has(post.id)),
        ];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
      } else {
        setFeedError(
          error instanceof Error ? error.message : "Unable to load more posts.",
        );
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  function setPostBusy(postId: string, isBusy: boolean) {
    setBusyPostIds((current) => {
      const next = new Set(current);
      if (isBusy) next.add(postId);
      else next.delete(postId);
      return next;
    });
  }

  async function handleToggleLike(post: FeedPost) {
    if (busyPostIds.has(post.id)) return;
    setPostActionError("");
    setPostBusy(post.id, true);
    try {
      const updatedPost = await setPostLiked(post.id, !post.likedByMe);
      setPosts((current) =>
        current.map((item) =>
          item.id === updatedPost.id ? updatedPost : item,
        ),
      );
    } catch (error) {
      if (!redirectIfUnauthorized(error)) {
        setPostActionError(
          error instanceof Error ? error.message : "Unable to update the like.",
        );
      }
    } finally {
      setPostBusy(post.id, false);
    }
  }

  async function handleShare(post: FeedPost) {
    if (busyPostIds.has(post.id)) return;
    setPostActionError("");
    setPostBusy(post.id, true);
    try {
      const sharedPost = await shareFeedPost(post.id);
      const originalPostId = post.sharedFrom?.id || post.id;
      setPosts((current) => [
        sharedPost,
        ...current.map((item) =>
          item.id === originalPostId
            ? { ...item, sharesCount: item.sharesCount + 1 }
            : item,
        ),
      ]);
    } catch (error) {
      if (!redirectIfUnauthorized(error)) {
        setPostActionError(
          error instanceof Error ? error.message : "Unable to share this post.",
        );
      }
    } finally {
      setPostBusy(post.id, false);
    }
  }

  async function handleCopyLink(post: FeedPost) {
    setPostActionError("");
    try {
      const url = new URL("/feed", window.location.origin);
      url.searchParams.set("post", post.id);
      await navigator.clipboard.writeText(url.toString());
      setPostActionError(
        "Link copied. It will only open for people allowed to see this post.",
      );
    } catch {
      setPostActionError(
        "Copy failed. Your browser may not allow clipboard access.",
      );
    }
  }

  async function toggleComments(postId: string) {
    setPostActionError("");
    if (commentPostId === postId) {
      setCommentPostId(null);
      return;
    }
    setCommentPostId(postId);
    if (comments[postId]) return;

    setCommentsLoadingId(postId);
    try {
      const page = await getPostComments(postId);
      setComments((current) => ({ ...current, [postId]: page.comments }));
    } catch (error) {
      if (!redirectIfUnauthorized(error)) {
        setPostActionError(
          error instanceof Error ? error.message : "Unable to load comments.",
        );
      }
    } finally {
      setCommentsLoadingId(null);
    }
  }

  async function handleAddComment(
    event: FormEvent<HTMLFormElement>,
    post: FeedPost,
  ) {
    event.preventDefault();
    const text = (commentDrafts[post.id] || "").trim();
    if (!text || busyPostIds.has(post.id)) return;
    setPostActionError("");
    setPostBusy(post.id, true);
    try {
      const comment = await addPostComment(post.id, text);
      setComments((current) => ({
        ...current,
        [post.id]: [...(current[post.id] || []), comment],
      }));
      setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, commentsCount: item.commentsCount + 1 }
            : item,
        ),
      );
    } catch (error) {
      if (!redirectIfUnauthorized(error)) {
        setPostActionError(
          error instanceof Error ? error.message : "Unable to add your comment.",
        );
      }
    } finally {
      setPostBusy(post.id, false);
    }
  }

  async function handleFriendSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = friendQuery.trim();
    setFriendError("");
    setFriendMessage("");
    if (query.length < 2) {
      setFriendResults([]);
      setFriendError("Enter at least 2 characters to search.");
      return;
    }
    setIsSearchingFriends(true);
    try {
      setFriendResults(await searchFriends(query));
    } catch (error) {
      if (!redirectIfUnauthorized(error)) {
        setFriendError(
          error instanceof Error ? error.message : "Unable to search for people.",
        );
      }
    } finally {
      setIsSearchingFriends(false);
    }
  }

  async function handleFriendAction(result: FriendSearchResult) {
    if (friendBusyUserId) return;
    setFriendError("");
    setFriendMessage("");
    setFriendBusyUserId(result.id);
    try {
      if (result.relation === "none") {
        await sendFriendRequest(result.id);
        setFriendMessage(`Friend request sent to ${result.name}.`);
      } else if (result.relation === "friends") {
        await removeFriend(result.id);
        setFriendMessage(`${result.name} was removed from your friends.`);
      } else {
        const requestId = getRelationshipId(
          friendData,
          result.id,
          result.relation,
        );
        if (!requestId)
          throw new Error("That friend request is no longer available.");
        if (result.relation === "incoming") {
          await acceptFriendRequest(requestId);
          setFriendMessage(`You and ${result.name} are friends now.`);
        } else {
          await deleteFriendRequest(requestId);
          setFriendMessage(`Request to ${result.name} was canceled.`);
        }
      }

      const updatedFriends = await getFriends();
      setFriendData(updatedFriends);
      if (friendQuery.trim().length >= 2) {
        setFriendResults(await searchFriends(friendQuery.trim()));
      }
    } catch (error) {
      if (!redirectIfUnauthorized(error)) {
        setFriendError(
          error instanceof Error
            ? error.message
            : "Unable to update this friend connection.",
        );
      }
    } finally {
      setFriendBusyUserId(null);
    }
  }

  async function handleRequestAction(
    requestId: string,
    action: "accept" | "decline",
  ) {
    setFriendError("");
    setFriendMessage("");
    setFriendBusyUserId(requestId);
    try {
      await (action === "accept"
        ? acceptFriendRequest(requestId)
        : deleteFriendRequest(requestId));
      const updatedFriends = await getFriends();
      setFriendData(updatedFriends);
      setFriendMessage(
        action === "accept" ? "Friend request accepted." : "Request declined.",
      );
      if (friendQuery.trim().length >= 2) {
        setFriendResults(await searchFriends(friendQuery.trim()));
      }
    } catch (error) {
      if (!redirectIfUnauthorized(error)) {
        setFriendError(
          error instanceof Error
            ? error.message
            : "Unable to update the request.",
        );
      }
    } finally {
      setFriendBusyUserId(null);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#09090f] text-sm text-gray-400">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-400">
          <UsersRound size={17} />
        </div>
        <span>Opening your community...</span>
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
          onClick={() => router.replace("/login")}
          className="rounded-xl bg-pink-500 px-4 py-2.5 font-semibold text-white hover:bg-pink-400"
        >
          Go to sign in
        </button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#09090f] text-white selection:bg-pink-500/30">
      <main className="relative flex min-h-screen w-full max-w-md flex-col border-x border-white/[0.06] bg-[#0d0d14] pb-28 shadow-2xl">
        <AppHeader
          title="Community"
          caption="MOMENTS, SHARED"
          brandIcon={UsersRound}
          rightAction={
            section === "feed" ? (
              <button
                type="button"
                onClick={() => {
                  setPostFormError("");
                  setIsComposing(true);
                }}
                aria-label="Create a post"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-pink-500/30 bg-pink-500/15 text-pink-300 transition hover:bg-pink-500/25"
              >
                <ImagePlus size={17} />
              </button>
            ) : null
          }
        />

        <div className="space-y-5 px-5 pb-8 pt-5">
          <section className="space-y-1 px-1">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-pink-300/80">
              LITTLE MOMENTS, BIG FEELINGS
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Your community
            </h1>
            <p className="text-sm leading-relaxed text-gray-400">
              Share a photo with everyone, your friends, or keep it just for
              you.
            </p>
          </section>

          <div
            aria-label="Community sections"
            className="grid grid-cols-2 rounded-2xl border border-white/[0.07] bg-[#15151f] p-1"
          >
            <button
              type="button"
              onClick={() => setSection("feed")}
              aria-pressed={section === "feed"}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition ${
                section === "feed"
                  ? "bg-pink-500/15 text-pink-200 shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Globe2 size={15} />
              Photo feed
            </button>
            <button
              type="button"
              onClick={() => {
                setFriendError("");
                setIsLoadingFriends(true);
                setSection("friends");
              }}
              aria-pressed={section === "friends"}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition ${
                section === "friends"
                  ? "bg-pink-500/15 text-pink-200 shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <UsersRound size={15} />
              Friends
              {friendData.incoming.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-400 px-1 text-[9px] text-[#160e17]">
                  {friendData.incoming.length}
                </span>
              )}
            </button>
          </div>

          {section === "feed" ? (
            <section className="space-y-4">
              <button
                type="button"
                onClick={() => setIsComposing(true)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#15151f] p-3.5 text-left transition hover:border-pink-500/25"
              >
                <Avatar
                  name={authUser.name}
                  image={authUser.profileImageUrl ?? undefined}
                  size="sm"
                />
                <span className="flex-1 rounded-xl bg-black/20 px-3.5 py-3 text-xs text-gray-500">
                  What moment would you like to share?
                </span>
                <ImagePlus size={18} className="text-pink-300" />
              </button>

              {linkedPostError && (
                <p
                  role="alert"
                  className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-xs leading-relaxed text-amber-200"
                >
                  {linkedPostError}
                </p>
              )}
              {postActionError && (
                <p
                  role="status"
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs leading-relaxed text-gray-300"
                >
                  {postActionError}
                </p>
              )}
              {feedError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-xs text-red-200"
                >
                  <span>{feedError}</span>
                  <button
                    type="button"
                    onClick={() => setReloadFeed((value) => value + 1)}
                    className="shrink-0 rounded-lg bg-white/[0.06] px-2.5 py-1.5 font-semibold text-white"
                  >
                    Try again
                  </button>
                </div>
              )}

              {isLoadingFeed ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/[0.06] bg-[#15151f]/70 py-16 text-sm text-gray-400">
                  <LoaderCircle
                    size={22}
                    className="animate-spin text-pink-300"
                  />
                  Loading the feed...
                </div>
              ) : posts.length > 0 ? (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <article
                      key={post.id}
                      className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#15151f] shadow-lg shadow-black/10"
                    >
                      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
                        <Avatar
                          name={post.author.name}
                          image={post.author.profileImageUrl ?? undefined}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {post.author.name}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
                            <span>{formatPostDate(post.createdAt)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              {post.visibility === "public" ? (
                                <Globe2 size={11} />
                              ) : post.visibility === "friends" ? (
                                <UsersRound size={11} />
                              ) : (
                                <Shield size={11} />
                              )}
                              {AUDIENCE_LABELS[post.visibility]}
                            </span>
                          </p>
                        </div>
                        {post.sharedFrom && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-[9px] font-medium text-gray-400">
                            <ArrowUpRight size={11} />
                            Shared
                          </span>
                        )}
                      </div>

                      {post.sharedFrom && (
                        <div className="px-4 pb-3 text-xs leading-relaxed text-gray-400">
                          Shared from{" "}
                          <span className="font-semibold text-pink-200">
                            {post.sharedFrom.authorName}
                          </span>
                          {post.sharedFrom.caption && (
                            <p className="mt-1 whitespace-pre-wrap text-gray-300">
                              {post.sharedFrom.caption}
                            </p>
                          )}
                        </div>
                      )}

                      <img
                        src={post.image}
                        alt={
                          post.caption || `Photo shared by ${post.author.name}`
                        }
                        loading="lazy"
                        className="max-h-[34rem] w-full bg-black/20 object-contain"
                      />

                      <div className="px-4 pb-4 pt-3">
                        {post.caption && (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
                            <span className="mr-1.5 font-semibold text-white">
                              {post.author.name}
                            </span>
                            {post.caption}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleToggleLike(post)}
                            disabled={busyPostIds.has(post.id)}
                            aria-pressed={post.likedByMe}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition disabled:opacity-50 ${
                              post.likedByMe
                                ? "text-pink-300"
                                : "text-gray-400 hover:bg-white/[0.05] hover:text-pink-200"
                            }`}
                          >
                            <Heart
                              size={16}
                              fill={post.likedByMe ? "currentColor" : "none"}
                            />
                            {post.likesCount}
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleComments(post.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs text-gray-400 transition hover:bg-white/[0.05] hover:text-white"
                          >
                            <MessageCircle size={16} />
                            {post.commentsCount}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleShare(post)}
                            disabled={busyPostIds.has(post.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs text-gray-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                          >
                            <ArrowUpRight size={16} />
                            {post.sharesCount}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyLink(post)}
                            aria-label="Copy post link"
                            className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs text-gray-400 transition hover:bg-white/[0.05] hover:text-pink-200"
                          >
                            <Link2 size={15} />
                            Link
                          </button>
                        </div>

                        {commentPostId === post.id && (
                          <div className="mt-2 border-t border-white/[0.06] pt-3">
                            {commentsLoadingId === post.id ? (
                              <p className="py-2 text-xs text-gray-500">
                                Loading comments...
                              </p>
                            ) : comments[post.id]?.length ? (
                              <div className="max-h-52 space-y-3 overflow-y-auto py-1">
                                {comments[post.id].map((comment) => (
                                  <div
                                    key={comment.id}
                                    className="flex items-start gap-2.5"
                                  >
                                    <Avatar
                                      name={comment.author.name}
                                      image={
                                        comment.author.profileImageUrl ??
                                        undefined
                                      }
                                      size="xs"
                                    />
                                    <p className="min-w-0 flex-1 rounded-xl bg-black/20 px-3 py-2 text-xs leading-relaxed text-gray-300">
                                      <span className="mr-1.5 font-semibold text-white">
                                        {comment.author.name}
                                      </span>
                                      {comment.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="py-2 text-xs text-gray-500">
                                No comments yet. Start the conversation.
                              </p>
                            )}
                            <form
                              onSubmit={(event) =>
                                void handleAddComment(event, post)
                              }
                              className="mt-3 flex items-center gap-2"
                            >
                              <input
                                aria-label="Write a comment"
                                maxLength={1000}
                                value={commentDrafts[post.id] || ""}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [post.id]: event.target.value,
                                  }))
                                }
                                placeholder="Write a comment..."
                                className="min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-xs text-white outline-none placeholder:text-gray-600 focus:border-pink-400/50"
                              />
                              <button
                                type="submit"
                                disabled={
                                  !commentDrafts[post.id]?.trim() ||
                                  busyPostIds.has(post.id)
                                }
                                aria-label="Send comment"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300 transition hover:bg-pink-500/25 disabled:opacity-40"
                              >
                                <Send size={15} />
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}

                  {nextCursor && (
                    <button
                      type="button"
                      onClick={() => void handleLoadMore()}
                      disabled={isLoadingMore}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#15151f] py-3 text-xs font-semibold text-gray-300 transition hover:border-pink-500/25 hover:text-white disabled:opacity-50"
                    >
                      {isLoadingMore ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      {isLoadingMore ? "Loading..." : "Load more"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/[0.1] bg-[#15151f]/60 px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-300">
                    <Sparkles size={21} />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-white">
                    Your feed is ready for a first moment
                  </h2>
                  <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-gray-400">
                    Share a photo, then invite friends to connect and see the
                    moments you choose.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsComposing(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2.5 text-xs font-semibold text-white"
                  >
                    <ImagePlus size={15} />
                    Share a photo
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-4">
              <div className="rounded-2xl border border-white/[0.08] bg-[#15151f] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-300">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Find your people
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-400">
                      Search by name or email. Friends-only photos are only
                      visible to accepted friends.
                    </p>
                  </div>
                </div>
                <form
                  onSubmit={(event) => void handleFriendSearch(event)}
                  className="mt-4 flex gap-2"
                >
                  <div className="relative min-w-0 flex-1">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                    />
                    <input
                      value={friendQuery}
                      onChange={(event) => setFriendQuery(event.target.value)}
                      maxLength={80}
                      aria-label="Search people by name or email"
                      placeholder="Name or email"
                      className="w-full rounded-xl border border-white/[0.08] bg-black/20 py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-gray-600 focus:border-pink-400/50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingFriends}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-pink-500/15 px-3.5 py-2.5 text-xs font-semibold text-pink-200 transition hover:bg-pink-500/25 disabled:opacity-50"
                  >
                    {isSearchingFriends ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : (
                      <Search size={14} />
                    )}
                    Search
                  </button>
                </form>
              </div>

              {friendError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-xs text-red-200"
                >
                  {friendError}
                </p>
              )}
              {friendMessage && (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-xs text-emerald-200"
                >
                  {friendMessage}
                </p>
              )}

              {friendResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Search results
                  </h3>
                  {friendResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#15151f] p-3"
                    >
                      <Avatar
                        name={result.name}
                        image={result.profileImageUrl ?? undefined}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {result.name}
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-500">
                          {result.relation === "friends"
                            ? "Friend"
                            : result.relation === "incoming"
                              ? "Sent you a request"
                              : result.relation === "outgoing"
                                ? "Request pending"
                                : "OurLove member"}
                        </p>
                      </div>
                      <FriendActionButton
                        relation={result.relation}
                        isBusy={friendBusyUserId === result.id}
                        onClick={() => void handleFriendAction(result)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {isLoadingFriends ? (
                <div className="flex items-center justify-center gap-2 py-7 text-xs text-gray-500">
                  <LoaderCircle size={15} className="animate-spin" />
                  Loading friends...
                </div>
              ) : (
                <>
                  {friendData.incoming.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Friend requests
                      </h3>
                      {friendData.incoming.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center gap-3 rounded-2xl border border-pink-500/15 bg-pink-500/[0.04] p-3"
                        >
                          <Avatar
                            name={request.user.name}
                            image={request.user.profileImageUrl ?? undefined}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              {request.user.name}
                            </p>
                            <p className="mt-0.5 text-[10px] text-gray-500">
                              Wants to connect with you
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={friendBusyUserId === request.id}
                            onClick={() =>
                              void handleRequestAction(request.id, "accept")
                            }
                            aria-label={`Accept ${request.user.name}'s request`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/15 text-pink-200 transition hover:bg-pink-500/25 disabled:opacity-50"
                          >
                            {friendBusyUserId === request.id ? (
                              <LoaderCircle
                                size={15}
                                className="animate-spin"
                              />
                            ) : (
                              <Check size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={friendBusyUserId === request.id}
                            onClick={() =>
                              void handleRequestAction(request.id, "decline")
                            }
                            aria-label={`Decline ${request.user.name}'s request`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-gray-400 transition hover:text-white disabled:opacity-50"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Your friends · {friendData.friends.length}
                    </h3>
                    {friendData.friends.length ? (
                      friendData.friends.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#15151f] p-3"
                        >
                          <Avatar
                            name={friend.user.name}
                            image={friend.user.profileImageUrl ?? undefined}
                            size="sm"
                          />
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                            {friend.user.name}
                          </p>
                          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
                            Connected
                          </span>
                          <button
                            type="button"
                            disabled={friendBusyUserId === friend.user.id}
                            onClick={() => {
                              const searchResult: FriendSearchResult = {
                                ...friend.user,
                                relation: "friends",
                              };
                              void handleFriendAction(searchResult);
                            }}
                            aria-label={`Remove ${friend.user.name} as a friend`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-50"
                          >
                            {friendBusyUserId === friend.user.id ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <UserRoundX size={15} />
                            )}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-xs leading-relaxed text-gray-500">
                        Your friend list is just getting started. Search for
                        someone above to send your first request.
                      </p>
                    )}
                  </div>

                  {friendData.outgoing.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Sent requests
                      </h3>
                      {friendData.outgoing.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#15151f] p-3"
                        >
                          <Avatar
                            name={request.user.name}
                            image={request.user.profileImageUrl ?? undefined}
                            size="sm"
                          />
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                            {request.user.name}
                          </p>
                          <span className="text-[10px] text-gray-500">
                            Pending
                          </span>
                          <button
                            type="button"
                            disabled={friendBusyUserId === request.id}
                            onClick={() =>
                              void handleRequestAction(request.id, "decline")
                            }
                            aria-label={`Cancel request to ${request.user.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                          >
                            {friendBusyUserId === request.id ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <X size={15} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        {isComposing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-post-title"
              className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-white/[0.12] bg-[#15151f] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                  <h2
                    id="create-post-title"
                    className="flex items-center gap-2 text-base font-semibold text-white"
                  >
                    <ImagePlus size={16} className="text-pink-300" />
                    Share a moment
                  </h2>
                  <p className="mt-1 text-xs text-gray-400">
                    Choose who gets to see your photo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isSavingPost) return;
                    setIsComposing(false);
                    resetPostForm();
                  }}
                  disabled={isSavingPost}
                  aria-label="Close create post"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-gray-400 transition hover:text-white disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <form
                onSubmit={(event) => void handleCreatePost(event)}
                className="space-y-4 overflow-y-auto p-5"
              >
                {postFormError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-200"
                  >
                    {postFormError}
                  </p>
                )}

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-300">
                    Photo
                  </span>
                  <label
                    htmlFor="post-image"
                    className="relative flex h-48 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/[0.15] bg-[#0d0d14] transition hover:border-pink-500/50"
                  >
                    {imagePreviewUrl ? (
                      <img
                        src={imagePreviewUrl}
                        alt="Selected post preview"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <ImagePlus size={24} className="mb-2 text-pink-300" />
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
                      id="post-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="post-caption"
                    className="text-xs font-semibold text-gray-300"
                  >
                    Caption{" "}
                    <span className="font-normal text-gray-500">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="post-caption"
                    rows={3}
                    maxLength={500}
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Add a little context to your photo..."
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#0d0d14] p-3.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-pink-400/60"
                  />
                  <p className="text-right text-[10px] text-gray-500">
                    {caption.length}/500
                  </p>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold text-gray-300">
                    Audience
                  </legend>
                  {(
                    [
                      ["public", "Public", "Anyone signed in can see this"],
                      ["friends", "Friends", "Only your accepted friends"],
                      ["private", "Only me", "Visible only to you"],
                    ] as const
                  ).map(([value, label, help]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                        visibility === value
                          ? "border-pink-400/35 bg-pink-500/[0.07]"
                          : "border-white/[0.07] bg-black/10 hover:border-white/[0.12]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="post-visibility"
                        value={value}
                        checked={visibility === value}
                        onChange={() => setVisibility(value)}
                        className="accent-pink-400"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-white">
                          {label}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-gray-500">
                          {help}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSavingPost) return;
                      setIsComposing(false);
                      resetPostForm();
                    }}
                    disabled={isSavingPost}
                    className="flex-1 rounded-xl bg-white/[0.05] py-3 text-xs font-semibold text-gray-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPost}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-xs font-semibold text-white shadow-md shadow-pink-950/30 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingPost && (
                      <LoaderCircle size={14} className="animate-spin" />
                    )}
                    {isSavingPost ? "Sharing..." : "Share photo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <BottomNav activeTab="feed" onTabChange={navigateToTab} />
      </main>
    </div>
  );
}

function FriendActionButton({
  relation,
  isBusy,
  onClick,
}: {
  relation: FriendSearchResult["relation"];
  isBusy: boolean;
  onClick: () => void;
}) {
  const label =
    relation === "friends"
      ? "Friends"
      : relation === "incoming"
        ? "Accept"
        : relation === "outgoing"
          ? "Cancel"
          : "Add";
  const Icon =
    relation === "friends"
      ? UserRoundCheck
      : relation === "incoming"
        ? Check
        : relation === "outgoing"
          ? X
          : UserPlus;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBusy}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-semibold transition disabled:opacity-50 ${
        relation === "friends"
          ? "bg-white/[0.05] text-gray-400 hover:bg-red-400/10 hover:text-red-200"
          : "bg-pink-500/15 text-pink-200 hover:bg-pink-500/25"
      }`}
    >
      {isBusy ? (
        <LoaderCircle size={13} className="animate-spin" />
      ) : (
        <Icon size={13} />
      )}
      {label}
    </button>
  );
}
