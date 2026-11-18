import { API_URL, ApiError } from "./api";

export interface PartnerSummary {
  id: string;
  name: string;
  profileImageUrl: string | null;
  lastSeenAt: string | null;
}

export interface PartnerInvitation {
  code: string;
  expiresAt: string;
}

export interface ArchivedPartnerProfile {
  id: string;
  formerPartner: PartnerSummary;
  anniversaryDate: string | null;
  loveNote: string;
  unlinkedAt: string;
  deletionCodeSet: boolean;
  youConfirmed: boolean;
  partnerConfirmed: boolean;
}

export interface PartnerPageData {
  partner: PartnerSummary | null;
  anniversaryDate: string | null;
  loveNote: string;
  memoriesCount: number;
  archivedProfiles: ArchivedPartnerProfile[];
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
    !Array.isArray(value.archivedProfiles) ||
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
    archivedProfiles: value.archivedProfiles.map(readArchivedPartnerProfile),
  };
}

function readPartner(value: unknown): PartnerSummary | null {
  if (value === null) return null;
  if (!isRecord(value)) {
    throw new Error("The partner API returned an invalid partner.");
  }

  const lastSeenAt = value.lastSeenAt;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    (value.profileImageUrl !== null &&
      typeof value.profileImageUrl !== "string") ||
    (lastSeenAt !== undefined &&
      lastSeenAt !== null &&
      (typeof lastSeenAt !== "string" ||
        Number.isNaN(Date.parse(lastSeenAt))))
  ) {
    throw new Error("The partner API returned an invalid partner.");
  }
  return {
    id: value.id,
    name: value.name,
    profileImageUrl: value.profileImageUrl,
    lastSeenAt: typeof lastSeenAt === "string" ? lastSeenAt : null,
  };
}

function readArchivedPartnerProfile(value: unknown): ArchivedPartnerProfile {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.unlinkedAt !== "string" ||
    !isRecord(value.profile) ||
    !(
      value.profile.anniversaryDate === null ||
      typeof value.profile.anniversaryDate === "string"
    ) ||
    typeof value.profile.loveNote !== "string" ||
    typeof value.deletionCodeSet !== "boolean" ||
    typeof value.youConfirmed !== "boolean" ||
    typeof value.partnerConfirmed !== "boolean"
  ) {
    throw new Error("The archived partner API returned an invalid profile.");
  }

  const formerPartner = readPartner(value.formerPartner);
  if (!formerPartner) {
    throw new Error("The archived partner API returned no former partner.");
  }

  return {
    id: value.id,
    formerPartner,
    anniversaryDate: value.profile.anniversaryDate,
    loveNote: value.profile.loveNote,
    unlinkedAt: value.unlinkedAt,
    deletionCodeSet: value.deletionCodeSet,
    youConfirmed: value.youConfirmed,
    partnerConfirmed: value.partnerConfirmed,
  };
}

export async function unlinkPartner(): Promise<PartnerPageData> {
  return readPartnerPageData(await requestPartner("/unlink", "POST"));
}

export async function confirmArchivedProfileDeletion(
  profileId: string,
  code: string,
): Promise<boolean> {
  const result = await requestPartner(
    `/archives/${encodeURIComponent(profileId)}/confirm-delete`,
    "POST",
    { code },
  );
  if (!isRecord(result) || typeof result.deleted !== "boolean") {
    throw new Error("The deletion API returned an invalid response.");
  }
  return result.deleted;
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
