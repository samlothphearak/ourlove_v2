import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import PartnerInvitation from "../models/PartnerInvitation.js";
import CoupleProfile from "../models/CoupleProfile.js";
import Memory from "../models/Memory.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/trusted-origin.middleware.js";

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

function hashInviteCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

function safePartner(user) {
  return user
    ? {
        id: user._id.toString(),
        name: user.name,
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

async function getPairContext(userId) {
  const user = await User.findById(userId).select("partnerId");
  if (!user) return { status: "missing" };
  if (!user.partnerId) return { status: "unpaired", user };

  const partner = await User.findById(user.partnerId).select("name partnerId");
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
  };
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
      message: "Your partner connection needs attention. Please try again later.",
    });
  }
  return null;
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.authUser._id)
      .select("partnerId")
      .populate("partnerId", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Your account could not be found.",
      });
    }

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      partner: safePartner(user.partnerId),
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

    const [profile, memoriesCount] = await Promise.all([
      pair.status === "paired"
        ? CoupleProfile.findOne(pair.pairFilter).lean()
        : Promise.resolve(null),
      Memory.countDocuments({ owner: pair.user._id }),
    ]);

    res.set("Cache-Control", "no-store");
    return res.json(
      profileResponse(
        pair.status === "paired" ? pair.partner : null,
        profile,
        memoriesCount,
      ),
    );
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
      if (body.anniversaryDate !== null && !validDateOnly(body.anniversaryDate)) {
        return res.status(400).json({
          success: false,
          message: "Anniversary date must be a valid YYYY-MM-DD date or null.",
        });
      }
      updates.anniversaryDate = body.anniversaryDate;
    }
    if (Object.prototype.hasOwnProperty.call(body, "loveNote")) {
      if (typeof body.loveNote !== "string" || body.loveNote.trim().length > 500) {
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
        pair.pairFilter,
        { $set: updates },
        { new: true, upsert: true, runValidators: true },
      ).lean();
      const memoriesCount = await Memory.countDocuments({
        owner: pair.user._id,
      });

      res.set("Cache-Control", "no-store");
      return res.json(profileResponse(pair.partner, profile, memoriesCount));
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

      const inviter = await User.findOneAndUpdate(
        { _id: invitation.inviter, partnerId: null },
        { $set: { partnerId: user._id } },
        { new: true },
      ).select("_id name");

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
