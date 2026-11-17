import { API_URL, ApiError } from "./api";

export interface PartnerSummary {
  id: string;
  name: string;
}

export interface PartnerInvitation {
  code: string;
  expiresAt: string;
}

export interface PartnerPageData {
  partner: PartnerSummary | null;
  anniversaryDate: string | null;
  loveNote: string;
  memoriesCount: number;
}

export type PartnerProfileUpdate = {
  anniversaryDate?: string | null;
  loveNote?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function requestPartner(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: {
    code?: string;
    anniversaryDate?: string | null;
    loveNote?: string;
  },
): Promise<unknown> {
  const response = await fetch(`${API_URL}/api/partners${path}`, {
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
        : "Unable to complete the partner request.";
    throw new ApiError(message, response.status);
  }

  return result;
}

function readPartnerPageData(value: unknown): PartnerPageData {
  if (
    !isRecord(value) ||
    !("partner" in value) ||
    !isRecord(value.profile) ||
    !(
      value.profile.anniversaryDate === null ||
      typeof value.profile.anniversaryDate === "string"
    ) ||
    typeof value.profile.loveNote !== "string" ||
    typeof value.memoriesCount !== "number" ||
    !Number.isInteger(value.memoriesCount) ||
    value.memoriesCount < 0
  ) {
    throw new Error("The partner profile API returned an invalid response.");
  }

  return {
    partner: readPartner(value.partner),
    anniversaryDate: value.profile.anniversaryDate,
    loveNote: value.profile.loveNote,
    memoriesCount: value.memoriesCount,
  };
}

function readPartner(value: unknown): PartnerSummary | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string"
  ) {
    throw new Error("The partner API returned an invalid partner.");
  }
  return { id: value.id, name: value.name };
}

export async function getPartnerPageData(): Promise<PartnerPageData> {
  return readPartnerPageData(await requestPartner("/profile", "GET"));
}

export async function updatePartnerProfile(
  updates: PartnerProfileUpdate,
): Promise<PartnerPageData> {
  return readPartnerPageData(
    await requestPartner("/profile", "PATCH", updates),
  );
}

export async function getPartnerStatus(): Promise<PartnerSummary | null> {
  const result = await requestPartner("/me", "GET");
  if (!isRecord(result) || !("partner" in result)) {
    throw new Error("The partner API returned an invalid response.");
  }
  return readPartner(result.partner);
}

export async function createPartnerInvitation(): Promise<PartnerInvitation> {
  const result = await requestPartner("/invitations", "POST");
  if (
    !isRecord(result) ||
    !isRecord(result.invitation) ||
    typeof result.invitation.code !== "string" ||
    typeof result.invitation.expiresAt !== "string"
  ) {
    throw new Error("The invitation API returned an invalid response.");
  }

  return {
    code: result.invitation.code,
    expiresAt: result.invitation.expiresAt,
  };
}

export async function acceptPartnerInvitation(
  code: string,
): Promise<PartnerSummary> {
  const result = await requestPartner("/accept", "POST", { code });
  if (!isRecord(result)) {
    throw new Error("The partner API returned an invalid response.");
  }
  const partner = readPartner(result.partner);
  if (!partner) {
    throw new Error("The partner API did not return a partner.");
  }
  return partner;
}
