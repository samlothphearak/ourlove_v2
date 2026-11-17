import { API_URL } from "./api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

interface AuthCredentials {
  email: string;
  password: string;
}

interface RegistrationDetails extends AuthCredentials {
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function requestAuth(
  path: string,
  method: "GET" | "POST",
  body?: AuthCredentials | RegistrationDetails,
): Promise<unknown> {
  const response = await fetch(`${API_URL}/api/auth${path}`, {
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
        : "Authentication request failed.";
    throw new AuthError(message, response.status);
  }

  return result;
}

function readUser(result: unknown): AuthUser {
  if (!isRecord(result) || !isRecord(result.user)) {
    throw new Error("The authentication server returned an invalid response.");
  }

  const user = result.user;
  if (
    typeof user.id !== "string" ||
    typeof user.name !== "string" ||
    typeof user.email !== "string"
  ) {
    throw new Error("The authentication server returned an invalid user.");
  }

  return { id: user.id, name: user.name, email: user.email };
}

export async function register(
  details: RegistrationDetails,
): Promise<AuthUser> {
  return readUser(await requestAuth("/register", "POST", details));
}

export async function login(
  credentials: AuthCredentials,
): Promise<AuthUser> {
  return readUser(await requestAuth("/login", "POST", credentials));
}

export async function getCurrentUser(): Promise<AuthUser> {
  return readUser(await requestAuth("/me", "GET"));
}

export async function logout(): Promise<void> {
  await requestAuth("/logout", "POST");
}