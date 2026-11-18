import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import Friendship from "../models/Friendship.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/trusted-origin.middleware.js";
import { getFriendshipKey } from "../lib/social.js";

const router = Router();
const friendWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    profileImageUrl: user.profileImageUrl || null,
  };
}

function serializeRelationship(relationship, viewerId) {
  const viewerIdString = viewerId.toString();
  const viewerIsA = relationship.userA._id.toString() === viewerIdString;
  const friend = viewerIsA ? relationship.userB : relationship.userA;
  return {
    id: relationship._id.toString(),
    user: serializeUser(friend),
    createdAt: relationship.createdAt.toISOString(),
    acceptedAt: relationship.acceptedAt
      ? relationship.acceptedAt.toISOString()
      : null,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUser._id;
    const relationships = await Friendship.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .sort({ updatedAt: -1 })
      .populate("userA", "name profileImageUrl")
      .populate("userB", "name profileImageUrl")
      .lean();

    const friends = [];
    const incoming = [];
    const outgoing = [];
    for (const relationship of relationships) {
      const item = serializeRelationship(relationship, userId);
      if (relationship.status === "accepted") {
        friends.push(item);
      } else if (relationship.requester.toString() === userId.toString()) {
        outgoing.push(item);
      } else {
        incoming.push(item);
      }
    }

    res.set("Cache-Control", "no-store");
    return res.json({ success: true, friends, incoming, outgoing });
  } catch (error) {
    return next(error);
  }
});

router.get("/search", requireAuth, async (req, res, next) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2 || query.length > 80) {
    return res.status(400).json({
      success: false,
      message: "Search with 2 to 80 characters.",
    });
  }

  try {
    const users = await User.find({
      _id: { $ne: req.authUser._id },
      $or: [
        { name: { $regex: `^${escapeRegExp(query)}`, $options: "i" } },
        { email: { $regex: `^${escapeRegExp(query)}`, $options: "i" } },
      ],
    })
      .select("_id name profileImageUrl")
      .sort({ name: 1, _id: 1 })
      .limit(20)
      .lean();
    const userIds = users.map((user) => user._id);
    const relationships = userIds.length
      ? await Friendship.find({
          $or: [
            { userA: req.authUser._id, userB: { $in: userIds } },
            { userB: req.authUser._id, userA: { $in: userIds } },
          ],
        })
          .select("userA userB requester status")
          .lean()
      : [];
    const byUserId = new Map();
    for (const relationship of relationships) {
      const otherId =
        relationship.userA.toString() === req.authUser._id.toString()
          ? relationship.userB.toString()
          : relationship.userA.toString();
      byUserId.set(otherId, relationship);
    }

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      users: users.map((user) => {
        const relationship = byUserId.get(user._id.toString());
        const relation =
          relationship?.status === "accepted"
            ? "friends"
            : relationship
              ? relationship.requester.toString() ===
                req.authUser._id.toString()
                ? "outgoing"
                : "incoming"
              : "none";
        return { ...serializeUser(user), relation };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/requests",
  requireAuth,
  requireTrustedOrigin,
  friendWriteLimiter,
  async (req, res, next) => {
    const targetId = req.body?.userId;
    if (
      typeof targetId !== "string" ||
      !mongoose.isObjectIdOrHexString(targetId) ||
      targetId === req.authUser._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid user to add as a friend.",
      });
    }

    try {
      const target = await User.findById(targetId).select("_id");
      if (!target) {
        return res.status(404).json({
          success: false,
          message: "That user could not be found.",
        });
      }

      const key = getFriendshipKey(req.authUser._id, target._id);
      const existing = await Friendship.findOne(key).lean();
      if (existing) {
        const message =
          existing.status === "accepted"
            ? "You are already friends."
            : existing.requester.toString() === req.authUser._id.toString()
              ? "A friend request is already pending."
              : "This user has already sent you a friend request.";
        return res.status(409).json({ success: false, message });
      }

      const request = await Friendship.create({
        ...key,
        requester: req.authUser._id,
        status: "pending",
      });
      res.set("Cache-Control", "no-store");
      return res.status(201).json({
        success: true,
        request: { id: request._id.toString() },
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "A friend request already exists.",
        });
      }
      return next(error);
    }
  },
);

router.post(
  "/requests/:requestId/accept",
  requireAuth,
  requireTrustedOrigin,
  friendWriteLimiter,
  async (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.requestId)) {
      return res.status(404).json({
        success: false,
        message: "Friend request not found.",
      });
    }

    try {
      const request = await Friendship.findOneAndUpdate(
        {
          _id: req.params.requestId,
          status: "pending",
          requester: { $ne: req.authUser._id },
          $or: [{ userA: req.authUser._id }, { userB: req.authUser._id }],
        },
        { $set: { status: "accepted", acceptedAt: new Date() } },
        { new: true },
      )
        .populate("userA", "name profileImageUrl")
        .populate("userB", "name profileImageUrl")
        .lean();

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Incoming friend request not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        friend: serializeRelationship(request, req.authUser._id),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/requests/:requestId",
  requireAuth,
  requireTrustedOrigin,
  friendWriteLimiter,
  async (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.requestId)) {
      return res.status(404).json({
        success: false,
        message: "Friend request not found.",
      });
    }

    try {
      const request = await Friendship.findOneAndDelete({
        _id: req.params.requestId,
        status: "pending",
        $or: [{ userA: req.authUser._id }, { userB: req.authUser._id }],
      });
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Friend request not found.",
        });
      }
      return res.json({ success: true, deleted: true });
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/:friendId",
  requireAuth,
  requireTrustedOrigin,
  friendWriteLimiter,
  async (req, res, next) => {
    if (
      !mongoose.isObjectIdOrHexString(req.params.friendId) ||
      req.params.friendId === req.authUser._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid friend to remove.",
      });
    }

    try {
      const friendship = await Friendship.findOneAndDelete({
        ...getFriendshipKey(req.authUser._id, req.params.friendId),
        status: "accepted",
      });
      if (!friendship) {
        return res.status(404).json({
          success: false,
          message: "Friend not found.",
        });
      }
      return res.json({ success: true, deleted: true });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
