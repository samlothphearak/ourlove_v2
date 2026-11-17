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
  createdAt: string;
}

export interface ChatHistoryPage {
  messages: ChatMessage[];
  nextCursor: string | null;
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

function readChatMessage(value: unknown): ChatMessage {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.senderId !== "string" ||
    typeof value.recipientId !== "string" ||
    typeof value.text !== "string" ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    throw new Error("The chat API returned an invalid message.");
  }

  return {
    id: value.id,
    senderId: value.senderId,
    recipientId: value.recipientId,
    text: value.text,
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
