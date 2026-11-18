import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import PartnerInvitation from "../models/PartnerInvitation.js";
import CoupleProfile from "../models/CoupleProfile.js";
import Memory from "../models/Memory.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/trusted-origin.middleware.js";
import { getChatRoomId } from "../lib/chat.js";

const router = Router();
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const partnerWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many invitation requests. Please try again later.",
    }),
});
const partnerLifecycleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many relationship changes. Please try again later.",
    }),
});
const deletionConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many deletion-code attempts. Please try again later.",
    }),
});

function hashInviteCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

function safePartner(user) {
  return user
    ? {
        id: user._id.toString(),
        name: user.name,
        profileImageUrl: user.profileImageUrl || null,
      }
    : null;
}

function validDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function getPairFilter(userId, partnerId) {
  const [userA, userB] = [userId.toString(), partnerId.toString()].sort();
  return { userA, userB };
}

export async function getPairContext(userId) {
  const user = await User.findById(userId).select("partnerId");
  if (!user) return { status: "missing" };
  if (!user.partnerId) return { status: "unpaired", user };

  const partner = await User.findById(user.partnerId).select(
    "name partnerId profileImageUrl lastSeenAt",
  );
  if (!partner || partner.partnerId?.toString() !== user._id.toString()) {
    return { status: "inconsistent", user };
  }

  return {
    status: "paired",
    user,
    partner,
    pairFilter: getPairFilter(user._id, partner._id),
  };
}

function profileResponse(partner, profile, memoriesCount) {
  return {
    success: true,
    partner: safePartner(partner),
    profile: {
      anniversaryDate: profile?.anniversaryDate || null,
      loveNote: profile?.loveNote || "",
    },
    memoriesCount,
    archivedProfiles: [],
  };
}

async function getArchivedProfiles(userId) {
  const userIdString = userId.toString();
  const profiles = await CoupleProfile.find({
    $or: [{ userA: userId }, { userB: userId }],
    unlinkedAt: { $ne: null },
  })
    .select(
      "userA userB anniversaryDate loveNote unlinkedAt deletionConfirmedBy",
    )
    .select("+deletionCodeHash")
    .sort({ updatedAt: -1 })
    .lean();

  const formerPartnerIds = profiles.map((profile) =>
    profile.userA.toString() === userIdString ? profile.userB : profile.userA,
  );
  const formerPartners = await User.find({ _id: { $in: formerPartnerIds } })
    .select("name profileImageUrl")
    .lean();
  const formerPartnerById = new Map(
    formerPartners.map((user) => [user._id.toString(), user]),
  );

  return profiles.map((profile, index) => {
    const formerPartnerId = formerPartnerIds[index].toString();
    const formerPartner = formerPartnerById.get(formerPartnerId);
    const confirmations = (profile.deletionConfirmedBy || []).map((id) =>
      id.toString(),
    );

    return {
      id: profile._id.toString(),
      formerPartner: formerPartner
        ? safePartner(formerPartner)
        : {
            id: formerPartnerId,
            name: "Former partner",
            profileImageUrl: null,
          },
      profile: {
        anniversaryDate: profile.anniversaryDate || null,
        loveNote: profile.loveNote || "",
      },
      unlinkedAt: profile.unlinkedAt.toISOString(),
      deletionCodeSet: Boolean(profile.deletionCodeHash),
      youConfirmed: confirmations.includes(userIdString),
      partnerConfirmed: confirmations.includes(formerPartnerId),
    };
  });
}

async function profilePayloadForUser(userId, pair) {
  const memoryOwnerIds =
    pair.status === "paired" ? [userId, pair.partner._id] : [userId];
  const activeProfile =
    pair.status === "paired"
      ? CoupleProfile.findOne({
          ...pair.pairFilter,
          unlinkedAt: null,
        }).lean()
      : Promise.resolve(null);
  const [profile, memoriesCount, archivedProfiles] = await Promise.all([
    activeProfile,
    Memory.countDocuments({ owner: { $in: memoryOwnerIds } }),
    getArchivedProfiles(userId),
  ]);
  return {
    ...profileResponse(
      pair.status === "paired" ? pair.partner : null,
      profile,
      memoriesCount,
    ),
    archivedProfiles,
  };
}

async function reconcileUnlinkState(pair, profileId, unlinkedAt) {
  const [user, partner] = await Promise.all([
    User.findById(pair.user._id).select("partnerId"),
    User.findById(pair.partner._id).select("partnerId"),
  ]);
  if (!user || !partner) {
    throw new Error("Unable to verify the partner connection after unlinking.");
  }

  const userPartnerId = user.partnerId?.toString() ?? null;
  const partnerPartnerId = partner.partnerId?.toString() ?? null;
  const userId = pair.user._id.toString();
  const partnerId = pair.partner._id.toString();

  if (userPartnerId === partnerId && partnerPartnerId === userId) {
    await CoupleProfile.updateOne(
      { _id: profileId, unlinkedAt },
      { $set: { unlinkedAt: null } },
    );
    return;
  }

  let restored = null;
  if (userPartnerId === partnerId && partnerPartnerId === null) {
    restored = await User.updateOne(
      { _id: partner._id, partnerId: null },
      { $set: { partnerId: user._id } },
    );
  } else if (userPartnerId === null && partnerPartnerId === userId) {
    restored = await User.updateOne(
      { _id: user._id, partnerId: null },
      { $set: { partnerId: partner._id } },
    );
  }

  if (restored?.matchedCount) {
    await CoupleProfile.updateOne(
      { _id: profileId, unlinkedAt },
      { $set: { unlinkedAt: null } },
    );
  }
}

function sendPairContextError(res, status) {
  if (status === "missing") {
    return res.status(404).json({
      success: false,
      message: "Your account could not be found.",
    });
  }
  if (status === "inconsistent") {
    return res.status(409).json({
      success: false,
      message:
        "Your partner connection needs attention. Please try again later.",
    });
  }
  return null;
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.authUser._id)
      .select("partnerId")
      .populate("partnerId", "name profileImageUrl lastSeenAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account could not be found.",
      });
    }

    res.set("Cache-Control", "no-store");
    const partner = safePartner(user.partnerId);
    return res.json({
      success: true,
      partner: partner
        ? {
            ...partner,
            lastSeenAt: user.partnerId.lastSeenAt
              ? user.partnerId.lastSeenAt.toISOString()
              : null,
          }
        : null,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const pair = await getPairContext(req.authUser._id);
    const pairError = sendPairContextError(res, pair.status);
    if (pairError) return pairError;

    const data = await profilePayloadForUser(pair.user._id, pair);
    res.set("Cache-Control", "no-store");
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/profile",
  requireAuth,
  requireTrustedOrigin,
  async (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        message: "Provide profile fields to update.",
      });
    }

    const keys = Object.keys(body);
    if (
      keys.length === 0 ||
      keys.some((key) => !["anniversaryDate", "loveNote"].includes(key))
    ) {
      return res.status(400).json({
        success: false,
        message: "Only anniversaryDate and loveNote can be updated.",
      });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, "anniversaryDate")) {
      if (
        body.anniversaryDate !== null &&
        !validDateOnly(body.anniversaryDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "Anniversary date must be a valid YYYY-MM-DD date or null.",
        });
      }
      updates.anniversaryDate = body.anniversaryDate;
    }
    if (Object.prototype.hasOwnProperty.call(body, "loveNote")) {
      if (
        typeof body.loveNote !== "string" ||
        body.loveNote.trim().length > 500
      ) {
        return res.status(400).json({
          success: false,
          message: "Love note must be 500 characters or fewer.",
        });
      }
      updates.loveNote = body.loveNote.trim();
    }

    try {
      const pair = await getPairContext(req.authUser._id);
      const pairError = sendPairContextError(res, pair.status);
      if (pairError) return pairError;
      if (pair.status !== "paired") {
        return res.status(409).json({
          success: false,
          message: "Connect with your partner before updating shared details.",
        });
      }

      const profile = await CoupleProfile.findOneAndUpdate(
        { ...pair.pairFilter, unlinkedAt: null },
        { $set: updates },
        { new: true, upsert: true, runValidators: true },
      ).lean();
      const [memoriesCount, archivedProfiles] = await Promise.all([
        Memory.countDocuments({
          owner: { $in: [pair.user._id, pair.partner._id] },
        }),
        getArchivedProfiles(pair.user._id),
      ]);
      res.set("Cache-Control", "no-store");
      return res.json({
        ...profileResponse(pair.partner, profile, memoriesCount),
        archivedProfiles,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/unlink",
  requireAuth,
  requireTrustedOrigin,
  partnerLifecycleLimiter,
  async (req, res, next) => {
    try {
      const pair = await getPairContext(req.authUser._id);
      const pairError = sendPairContextError(res, pair.status);
      if (pairError) return pairError;
      if (pair.status !== "paired") {
        return res.status(409).json({
          success: false,
          message: "Your account is not connected to a partner.",
        });
      }

      const now = new Date();
      const archivedProfile = await CoupleProfile.findOneAndUpdate(
        pair.pairFilter,
        {
          $set: {
            unlinkedAt: now,
            deletionCodeHash: null,
            deletionConfirmedBy: [],
          },
        },
        { new: true, upsert: true, runValidators: true },
      );

      let unlinkedUser;
      try {
        unlinkedUser = await User.findOneAndUpdate(
          { _id: pair.user._id, partnerId: pair.partner._id },
          { $set: { partnerId: null } },
          { new: true },
        ).select("_id");
      } catch (error) {
        await reconcileUnlinkState(
          pair,
          archivedProfile._id,
          archivedProfile.unlinkedAt,
        );
        return next(error);
      }

      if (!unlinkedUser) {
        await reconcileUnlinkState(
          pair,
          archivedProfile._id,
          archivedProfile.unlinkedAt,
        );
        return res.status(409).json({
          success: false,
          message: "Your partner connection changed. Refresh and try again.",
        });
      }

      let unlinkedPartner;
      try {
        unlinkedPartner = await User.findOneAndUpdate(
          { _id: pair.partner._id, partnerId: pair.user._id },
          { $set: { partnerId: null } },
          { new: true },
        ).select("_id");
      } catch (error) {
        await reconcileUnlinkState(
          pair,
          archivedProfile._id,
          archivedProfile.unlinkedAt,
        );
        return next(error);
      }

      if (!unlinkedPartner) {
        await reconcileUnlinkState(
          pair,
          archivedProfile._id,
          archivedProfile.unlinkedAt,
        );
        const updatedPair = await getPairContext(pair.user._id);
        if (updatedPair.status !== "unpaired") {
          return res.status(409).json({
            success: false,
            message: "Your partner connection changed. Refresh and try again.",
          });
        }
      }

      const io = req.app.get("io");
      if (io) {
        const room = getChatRoomId(pair.user._id, pair.partner._id);
        io.to(room).emit("chat:unavailable");
        io.in(room).disconnectSockets(true);
      }

      const result = await profilePayloadForUser(pair.user._id, {
        status: "unpaired",
        user: pair.user,
      });
      res.set("Cache-Control", "no-store");
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/archives/:profileId/confirm-delete",
  requireAuth,
  requireTrustedOrigin,
  deletionConfirmLimiter,
  async (req, res, next) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    if (
      code.length < 8 ||
      code.length > 64 ||
      code.trim() !== code ||
      Buffer.byteLength(code, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "The shared secret must be 8 to 64 characters.",
      });
    }
    if (!/^[0-9a-f]{24}$/i.test(req.params.profileId)) {
      return res.status(404).json({
        success: false,
        message: "The archived couple profile could not be found.",
      });
    }

    try {
      const userId = req.authUser._id;
      const archiveFilter = {
        _id: req.params.profileId,
        unlinkedAt: { $ne: null },
        $or: [{ userA: userId }, { userB: userId }],
      };
      let archive =
        await CoupleProfile.findOne(archiveFilter).select("+deletionCodeHash");
      if (!archive) {
        return res.status(404).json({
          success: false,
          message: "The archived couple profile could not be found.",
        });
      }

      const userIdString = userId.toString();
      const alreadyConfirmed = archive.deletionConfirmedBy.some(
        (id) => id.toString() === userIdString,
      );

      if (archive.deletionCodeHash) {
        const matches = await bcrypt.compare(code, archive.deletionCodeHash);
        if (!matches) {
          return res.status(400).json({
            success: false,
            message: "The shared secret does not match.",
          });
        }
      } else {
        if (alreadyConfirmed) {
          return res.status(409).json({
            success: false,
            message:
              "Your confirmation cannot be verified. Please contact support.",
          });
        }
        const deletionCodeHash = await bcrypt.hash(code, 12);
        const proposedArchive = await CoupleProfile.findOneAndUpdate(
          { ...archiveFilter, deletionCodeHash: null },
          {
            $set: { deletionCodeHash },
            $addToSet: { deletionConfirmedBy: userId },
          },
          { new: true },
        ).select("+deletionCodeHash");

        if (proposedArchive) {
          archive = proposedArchive;
        } else {
          archive =
            await CoupleProfile.findOne(archiveFilter).select(
              "+deletionCodeHash",
            );
          if (!archive) {
            return res.status(404).json({
              success: false,
              message: "The archived couple profile could not be found.",
            });
          }
          const matches =
            archive.deletionCodeHash &&
            (await bcrypt.compare(code, archive.deletionCodeHash));
          if (!matches) {
            return res.status(400).json({
              success: false,
              message: "The shared secret does not match.",
            });
          }
        }
      }

      const confirmedNow = archive.deletionConfirmedBy.some(
        (id) => id.toString() === userIdString,
      );
      if (!confirmedNow) {
        archive = await CoupleProfile.findOneAndUpdate(
          {
            ...archiveFilter,
            deletionCodeHash: archive.deletionCodeHash,
          },
          { $addToSet: { deletionConfirmedBy: userId } },
          { new: true },
        ).select("+deletionCodeHash");
        if (!archive) {
          return res.status(409).json({
            success: false,
            message: "The shared profile changed. Refresh and try again.",
          });
        }
      }

      const userAConfirmed = archive.deletionConfirmedBy.some(
        (id) => id.toString() === archive.userA.toString(),
      );
      const userBConfirmed = archive.deletionConfirmedBy.some(
        (id) => id.toString() === archive.userB.toString(),
      );
      if (userAConfirmed && userBConfirmed) {
        const deletion = await CoupleProfile.deleteOne({
          _id: archive._id,
          deletionCodeHash: archive.deletionCodeHash,
          deletionConfirmedBy: { $all: [archive.userA, archive.userB] },
        });
        if (deletion.deletedCount !== 1) {
          return res.status(409).json({
            success: false,
            message: "The archived profile changed. Refresh and try again.",
          });
        }
        res.set("Cache-Control", "no-store");
        return res.json({ success: true, deleted: true });
      }

      res.set("Cache-Control", "no-store");
      return res.json({ success: true, deleted: false });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/invitations",
  requireAuth,
  requireTrustedOrigin,
  partnerWriteLimiter,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.authUser._id).select("partnerId");
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Your account could not be found.",
        });
      }
      if (user.partnerId) {
        return res.status(409).json({
          success: false,
          message: "Your account is already connected to a partner.",
        });
      }

      const now = new Date();
      await PartnerInvitation.updateMany(
        {
          inviter: user._id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        { $set: { revokedAt: now } },
      );

      const code = randomBytes(24).toString("base64url");
      const expiresAt = new Date(now.getTime() + invitationLifetimeMs);
      const invitation = await PartnerInvitation.create({
        inviter: user._id,
        codeHash: hashInviteCode(code),
        expiresAt,
      });

      return res.status(201).json({
        success: true,
        invitation: {
          code,
          expiresAt: invitation.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/accept",
  requireAuth,
  requireTrustedOrigin,
  partnerWriteLimiter,
  async (req, res, next) => {
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    if (!/^[A-Za-z0-9_-]{32}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid invitation link.",
      });
    }

    try {
      const user = await User.findById(req.authUser._id).select("partnerId");
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Your account could not be found.",
        });
      }
      if (user.partnerId) {
        return res.status(409).json({
          success: false,
          message: "Your account is already connected to a partner.",
        });
      }

      const now = new Date();
      const invitation = await PartnerInvitation.findOneAndUpdate(
        {
          codeHash: hashInviteCode(code),
          inviter: { $ne: user._id },
          expiresAt: { $gt: now },
          acceptedAt: null,
          revokedAt: null,
        },
        {
          $set: {
            acceptedAt: now,
            acceptedBy: user._id,
          },
        },
        { new: true },
      );

      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: "This invitation is invalid, expired, or already used.",
        });
      }

      const previousCoupleProfile = await CoupleProfile.findOne(
        getPairFilter(user._id, invitation.inviter),
      )
        .select("+deletionCodeHash")
        .lean();

      const inviter = await User.findOneAndUpdate(
        { _id: invitation.inviter, partnerId: null },
        { $set: { partnerId: user._id } },
        { new: true },
      ).select("_id name profileImageUrl");

      if (!inviter) {
        await PartnerInvitation.updateOne(
          { _id: invitation._id, acceptedBy: user._id },
          { $set: { acceptedAt: null, acceptedBy: null } },
        );
        return res.status(409).json({
          success: false,
          message: "The inviter is already connected to a partner.",
        });
      }

      let pairedUser;
      try {
        pairedUser = await User.findOneAndUpdate(
          { _id: user._id, partnerId: null },
          { $set: { partnerId: inviter._id } },
          { new: true },
        ).select("_id");
      } catch (error) {
        await User.updateOne(
          { _id: inviter._id, partnerId: user._id },
          { $set: { partnerId: null } },
        );
        await PartnerInvitation.updateOne(
          { _id: invitation._id, acceptedBy: user._id },
          { $set: { acceptedAt: null, acceptedBy: null } },
        );
        return next(error);
      }

      if (!pairedUser) {
        await User.updateOne(
          { _id: inviter._id, partnerId: user._id },
          { $set: { partnerId: null } },
        );
        await PartnerInvitation.updateOne(
          { _id: invitation._id, acceptedBy: user._id },
          { $set: { acceptedAt: null, acceptedBy: null } },
        );
        return res.status(409).json({
          success: false,
          message: "Your account was connected to another partner.",
        });
      }

      if (previousCoupleProfile?.unlinkedAt) {
        try {
          await CoupleProfile.updateOne(
            {
              _id: previousCoupleProfile._id,
              unlinkedAt: previousCoupleProfile.unlinkedAt,
            },
            {
              $set: {
                unlinkedAt: null,
                deletionConfirmedBy: [],
              },
              $unset: { deletionCodeHash: 1 },
            },
          );
        } catch (error) {
          await User.updateOne(
            { _id: user._id, partnerId: inviter._id },
            { $set: { partnerId: null } },
          );
          await User.updateOne(
            { _id: inviter._id, partnerId: user._id },
            { $set: { partnerId: null } },
          );
          const restoreFields = {
            unlinkedAt: previousCoupleProfile.unlinkedAt,
            deletionConfirmedBy:
              previousCoupleProfile.deletionConfirmedBy || [],
          };
          if (previousCoupleProfile.deletionCodeHash) {
            restoreFields.deletionCodeHash =
              previousCoupleProfile.deletionCodeHash;
          }
          await CoupleProfile.updateOne(
            { _id: previousCoupleProfile._id },
            {
              $set: restoreFields,
              ...(previousCoupleProfile.deletionCodeHash
                ? {}
                : { $unset: { deletionCodeHash: 1 } }),
            },
          );
          await PartnerInvitation.updateOne(
            { _id: invitation._id, acceptedBy: user._id },
            { $set: { acceptedAt: null, acceptedBy: null } },
          );
          return next(error);
        }
      }

      return res.json({
        success: true,
        partner: safePartner(inviter),
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
