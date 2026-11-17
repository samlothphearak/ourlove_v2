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
