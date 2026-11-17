const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface HealthResponse {
  success: boolean;
  message: string;
  database: "connected" | "disconnected";
  timestamp: string;
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
