export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface HealthResponse {
  success: boolean;
  message: string;
  database: "connected" | "disconnected";
  timestamp: string;
}

export interface Memory {
  id: string;
  title: string;
  date: string;
  image: string;
  type: string;
}

export interface MemoryRecord {
  id: string;
  title: string;
  date: string;
  image: string;
  category: string;
  description: string;
  likesCount: number;
  likedByMe: boolean;
}

export interface CreateMemoryInput {
  title: string;
  category: string;
  description: string;
  image: File;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  seenAt: string | null;
  memory: ChatMemoryAttachment | null;
  createdAt: string;
}

export interface ChatMemoryAttachment {
  id: string;
  title: string;
  date: string;
  image: string;
  category: string;
  description: string;
}

export interface ChatHistoryPage {
  messages: ChatMessage[];
  nextCursor: string | null;
}

export type PostVisibility = "public" | "friends" | "private";

export interface SocialUser {
  id: string;
  name: string;
  profileImageUrl: string | null;
}

export interface FriendRelationship {
  id: string;
  user: SocialUser;
  createdAt: string;
  acceptedAt: string | null;
}

export interface FriendData {
  friends: FriendRelationship[];
  incoming: FriendRelationship[];
  outgoing: FriendRelationship[];
}

export type FriendSearchResult = SocialUser & {
  relation: "none" | "friends" | "incoming" | "outgoing";
};

export interface FeedPost {
  id: string;
  author: SocialUser;
  image: string;
  caption: string;
  visibility: PostVisibility;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  likedByMe: boolean;
  sharedFrom: {
    id: string;
    authorId: string;
    authorName: string;
    caption: string;
  } | null;
}

export interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

export interface PostComment {
  id: string;
  author: SocialUser;
  text: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSocialUser(value: unknown): SocialUser {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    (value.profileImageUrl !== null &&
      typeof value.profileImageUrl !== "string")
  ) {
    throw new Error("The social API returned an invalid user.");
  }
  return {
    id: value.id,
    name: value.name,
    profileImageUrl: value.profileImageUrl,
  };
}

function readPost(value: unknown): FeedPost {
  if (!isRecord(value)) {
    throw new Error("The feed API returned an invalid post.");
  }
  const visibility = value.visibility;
  let sharedFrom: FeedPost["sharedFrom"] = null;
  if (value.sharedFrom !== null && value.sharedFrom !== undefined) {
    if (
      !isRecord(value.sharedFrom) ||
      typeof value.sharedFrom.id !== "string" ||
      typeof value.sharedFrom.authorId !== "string" ||
      typeof value.sharedFrom.authorName !== "string" ||
      typeof value.sharedFrom.caption !== "string"
    ) {
      throw new Error("The feed API returned an invalid repost.");
    }
    sharedFrom = {
      id: value.sharedFrom.id,
      authorId: value.sharedFrom.authorId,
      authorName: value.sharedFrom.authorName,
      caption: value.sharedFrom.caption,
    };
  }
  if (
    typeof value.id !== "string" ||
    !isRecord(value.author) ||
    typeof value.image !== "string" ||
    typeof value.caption !== "string" ||
    (visibility !== "public" &&
      visibility !== "friends" &&
      visibility !== "private") ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    typeof value.likesCount !== "number" ||
    !Number.isInteger(value.likesCount) ||
    value.likesCount < 0 ||
    typeof value.commentsCount !== "number" ||
    !Number.isInteger(value.commentsCount) ||
    value.commentsCount < 0 ||
    typeof value.sharesCount !== "number" ||
    !Number.isInteger(value.sharesCount) ||
    value.sharesCount < 0 ||
    typeof value.likedByMe !== "boolean"
  ) {
    throw new Error("The feed API returned an invalid post.");
  }
  return {
    id: value.id,
    author: readSocialUser(value.author),
    image: value.image,
    caption: value.caption,
    visibility,
    createdAt: value.createdAt,
    likesCount: value.likesCount,
    commentsCount: value.commentsCount,
    sharesCount: value.sharesCount,
    likedByMe: value.likedByMe,
    sharedFrom,
  };
}

async function requestSocial(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      isRecord(result) && typeof result.message === "string"
        ? result.message
        : "Unable to complete this social request.";
    throw new ApiError(message, response.status);
  }
  return result;
}

export async function getFeed(before?: string): Promise<FeedPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  const result = await requestSocial(`/api/posts/feed${query}`, "GET");
  if (
    !isRecord(result) ||
    !Array.isArray(result.posts) ||
    !(result.nextCursor === null || typeof result.nextCursor === "string")
  ) {
    throw new Error("The feed API returned an invalid response.");
  }
  return {
    posts: result.posts.map(readPost),
    nextCursor: result.nextCursor,
  };
}

export async function getFeedPost(postId: string): Promise<FeedPost> {
  const result = await requestSocial(
    `/api/posts/${encodeURIComponent(postId)}`,
    "GET",
  );
  if (!isRecord(result) || !("post" in result)) {
    throw new Error("The post API returned an invalid response.");
  }
  return readPost(result.post);
}

export async function createFeedPost(input: {
  image: File;
  caption: string;
  visibility: PostVisibility;
}): Promise<FeedPost> {
  const body = new FormData();
  body.append("image", input.image);
  body.append("caption", input.caption);
  body.append("visibility", input.visibility);
  const response = await fetch(`${API_URL}/api/posts`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    body,
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      isRecord(result) && typeof result.message === "string"
        ? result.message
        : "Unable to create your post.";
    throw new ApiError(message, response.status);
  }
  if (!isRecord(result) || !("post" in result)) {
    throw new Error("The post API returned an invalid response.");
  }
  return readPost(result.post);
}

export async function setPostLiked(
  postId: string,
  liked: boolean,
): Promise<FeedPost> {
  const result = await requestSocial(
    `/api/posts/${encodeURIComponent(postId)}/like`,
    liked ? "PUT" : "DELETE",
  );
  if (!isRecord(result) || !("post" in result)) {
    throw new Error("The post API returned an invalid response.");
  }
  return readPost(result.post);
}

export async function shareFeedPost(postId: string): Promise<FeedPost> {
  const result = await requestSocial(
    `/api/posts/${encodeURIComponent(postId)}/share`,
    "POST",
    {},
  );
  if (!isRecord(result) || !("post" in result)) {
    throw new Error("The share API returned an invalid response.");
  }
  return readPost(result.post);
}

export async function getPostComments(
  postId: string,
  before?: string,
): Promise<{ comments: PostComment[]; nextCursor: string | null }> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  const result = await requestSocial(
    `/api/posts/${encodeURIComponent(postId)}/comments${query}`,
    "GET",
  );
  if (
    !isRecord(result) ||
    !Array.isArray(result.comments) ||
    !(result.nextCursor === null || typeof result.nextCursor === "string")
  ) {
    throw new Error("The comments API returned an invalid response.");
  }
  return {
    comments: result.comments.map((value) => {
      if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        typeof value.text !== "string" ||
        typeof value.createdAt !== "string" ||
        Number.isNaN(Date.parse(value.createdAt))
      ) {
        throw new Error("The comments API returned an invalid comment.");
      }
      return {
        id: value.id,
        author: readSocialUser(value.author),
        text: value.text,
        createdAt: value.createdAt,
      };
    }),
    nextCursor: result.nextCursor,
  };
}

export async function addPostComment(
  postId: string,
  text: string,
): Promise<PostComment> {
  const result = await requestSocial(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    "POST",
    { text },
  );
  if (!isRecord(result) || !isRecord(result.comment)) {
    throw new Error("The comments API returned an invalid response.");
  }
  const value = result.comment;
  if (
    typeof value.id !== "string" ||
    typeof value.text !== "string" ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    throw new Error("The comments API returned an invalid comment.");
  }
  return {
    id: value.id,
    author: readSocialUser(value.author),
    text: value.text,
    createdAt: value.createdAt,
  };
}

export async function getFriends(): Promise<FriendData> {
  const result = await requestSocial("/api/friends", "GET");
  if (
    !isRecord(result) ||
    !Array.isArray(result.friends) ||
    !Array.isArray(result.incoming) ||
    !Array.isArray(result.outgoing)
  ) {
    throw new Error("The friends API returned an invalid response.");
  }
  const readRelationship = (value: unknown): FriendRelationship => {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      typeof value.createdAt !== "string" ||
      Number.isNaN(Date.parse(value.createdAt)) ||
      !(value.acceptedAt === null || typeof value.acceptedAt === "string")
    ) {
      throw new Error("The friends API returned an invalid relationship.");
    }
    return {
      id: value.id,
      user: readSocialUser(value.user),
      createdAt: value.createdAt,
      acceptedAt: value.acceptedAt,
    };
  };
  return {
    friends: result.friends.map(readRelationship),
    incoming: result.incoming.map(readRelationship),
    outgoing: result.outgoing.map(readRelationship),
  };
}

export async function searchFriends(
  query: string,
): Promise<FriendSearchResult[]> {
  const result = await requestSocial(
    `/api/friends/search?q=${encodeURIComponent(query)}`,
    "GET",
  );
  if (!isRecord(result) || !Array.isArray(result.users)) {
    throw new Error("The friend search API returned an invalid response.");
  }
  return result.users.map((value) => {
    if (
      !isRecord(value) ||
      (value.relation !== "none" &&
        value.relation !== "friends" &&
        value.relation !== "incoming" &&
        value.relation !== "outgoing")
    ) {
      throw new Error("The friend search API returned an invalid user.");
    }
    return { ...readSocialUser(value), relation: value.relation };
  });
}

export async function sendFriendRequest(userId: string): Promise<void> {
  await requestSocial("/api/friends/requests", "POST", { userId });
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await requestSocial(
    `/api/friends/requests/${encodeURIComponent(requestId)}/accept`,
    "POST",
    {},
  );
}

export async function deleteFriendRequest(requestId: string): Promise<void> {
  await requestSocial(
    `/api/friends/requests/${encodeURIComponent(requestId)}`,
    "DELETE",
  );
}

export async function removeFriend(userId: string): Promise<void> {
  await requestSocial(
    `/api/friends/${encodeURIComponent(userId)}`,
    "DELETE",
  );
}

function readChatMemoryAttachment(
  value: unknown,
): ChatMemoryAttachment | null {
  if (value === null || value === undefined) return null;
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.date !== "string" ||
    Number.isNaN(Date.parse(value.date)) ||
    typeof value.image !== "string" ||
    typeof value.category !== "string" ||
    typeof value.description !== "string"
  ) {
    throw new Error("The chat API returned an invalid memory attachment.");
  }

  return {
    id: value.id,
    title: value.title,
    date: value.date,
    image: value.image,
    category: value.category,
    description: value.description,
  };
}

function readChatMessage(value: unknown): ChatMessage {
  if (!isRecord(value)) {
    throw new Error("The chat API returned an invalid message.");
  }
  const memory = readChatMemoryAttachment(value.memory);
  const seenAt = value.seenAt ?? null;
  if (
    typeof value.id !== "string" ||
    typeof value.senderId !== "string" ||
    typeof value.recipientId !== "string" ||
    typeof value.text !== "string" ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    (seenAt !== null &&
      (typeof seenAt !== "string" || Number.isNaN(Date.parse(seenAt))))
  ) {
    throw new Error("The chat API returned an invalid message.");
  }

  return {
    id: value.id,
    senderId: value.senderId,
    recipientId: value.recipientId,
    text: value.text,
    seenAt,
    memory,
    createdAt: value.createdAt,
  };
}

export async function getChatMessages(
  before?: string,
): Promise<ChatHistoryPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  const response = await fetch(`${API_URL}/api/chat/messages${query}`, {
    credentials: "include",
    cache: "no-store",
  });
  const result: unknown = await response.json();

  if (!response.ok) {
    const message =
      isRecord(result) && typeof result.message === "string"
        ? result.message
        : "Unable to load your chat history.";
    throw new ApiError(message, response.status);
  }

  if (
    !isRecord(result) ||
    !Array.isArray(result.messages) ||
    !(result.nextCursor === null || typeof result.nextCursor === "string")
  ) {
    throw new Error("The chat API returned an invalid history response.");
  }

  return {
    messages: result.messages.map(readChatMessage),
    nextCursor: result.nextCursor,
  };
}

function readMemoryRecord(value: unknown): MemoryRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.date !== "string" ||
    typeof value.image !== "string" ||
    typeof value.category !== "string" ||
    typeof value.description !== "string" ||
    typeof value.likesCount !== "number" ||
    !Number.isInteger(value.likesCount) ||
    value.likesCount < 0 ||
    typeof value.likedByMe !== "boolean"
  ) {
    throw new Error("The memories API returned an invalid memory.");
  }

  return {
    id: value.id,
    title: value.title,
    date: value.date,
    image: value.image,
    category: value.category,
    description: value.description,
    likesCount: value.likesCount,
    likedByMe: value.likedByMe,
  };
}

async function requestMemories(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${API_URL}/api/memories${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
  });
  const result: unknown = await response.json();

  if (!response.ok) {
    const message =
      isRecord(result) && typeof result.message === "string"
        ? result.message
        : "Unable to complete the memory request.";
    throw new ApiError(message, response.status);
  }

  return result;
}

export async function getMemories(): Promise<MemoryRecord[]> {
  const result = await requestMemories("");
  if (!isRecord(result) || !Array.isArray(result.memories)) {
    throw new Error("The memories API returned an invalid response.");
  }
  return result.memories.map(readMemoryRecord);
}

export async function createMemory(
  input: CreateMemoryInput,
): Promise<MemoryRecord> {
  const body = new FormData();
  body.append("title", input.title);
  body.append("category", input.category);
  body.append("description", input.description);
  body.append("image", input.image);

  const result = await requestMemories("", {
    method: "POST",
    body,
  });
  if (!isRecord(result) || !("memory" in result)) {
    throw new Error("The memories API returned an invalid response.");
  }
  return readMemoryRecord(result.memory);
}

export async function setMemoryLiked(
  memoryId: string,
  liked: boolean,
): Promise<MemoryRecord> {
  const result = await requestMemories(
    `/${encodeURIComponent(memoryId)}/like`,
    { method: liked ? "PUT" : "DELETE" },
  );
  if (!isRecord(result) || !("memory" in result)) {
    throw new Error("The memories API returned an invalid response.");
  }
  return readMemoryRecord(result.memory);
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/api/health`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to connect to OurLove API");
  }

  return response.json() as Promise<HealthResponse>;
}

export async function getRecentMemories(): Promise<Memory[]> {
  const response = await fetch(`${API_URL}/api/memories/recent`, {
    credentials: "include",
    cache: "no-store",
  });
  const result: unknown = await response.json();

  if (!response.ok) {
    const message =
      isRecord(result) && typeof result.message === "string"
        ? result.message
        : "Unable to load recent memories.";
    throw new ApiError(message, response.status);
  }

  if (!isRecord(result) || !Array.isArray(result.memories)) {
    throw new Error("The memories API returned an invalid response.");
  }

  return result.memories.map((value) => {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      typeof value.title !== "string" ||
      typeof value.date !== "string" ||
      typeof value.image !== "string" ||
      typeof value.type !== "string"
    ) {
      throw new Error("The memories API returned an invalid memory.");
    }

    return {
      id: value.id,
      title: value.title,
      date: value.date,
      image: value.image,
      type: value.type,
    };
  });
}
