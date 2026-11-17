import { Router } from "express";
import mongoose from "mongoose";
import ChatMessage from "../models/ChatMessage.js";
import { getPairContext } from "./partner.routes.js";
import { getChatRoomId, serializeChatMessage } from "../lib/chat.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
const pageSize = 50;

router.get("/messages", requireAuth, async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  try {
    const pair = await getPairContext(req.authUser._id);
    if (pair.status !== "paired") {
      return res.status(pair.status === "missing" ? 404 : 409).json({
        success: false,
        message: "Connect with your partner to open your chat.",
      });
    }

    const conversationId = getChatRoomId(pair.user._id, pair.partner._id);
    const before = req.query.before;
    if (
      before !== undefined &&
      (typeof before !== "string" || !mongoose.isValidObjectId(before))
    ) {
      return res.status(400).json({
        success: false,
        message: "The chat history cursor is invalid.",
      });
    }

    const filter = { conversationId };
    if (before) {
      const cursor = await ChatMessage.findOne({
        _id: before,
        conversationId,
      })
        .select("createdAt")
        .lean();
      if (!cursor) {
        return res.status(400).json({
          success: false,
          message: "The chat history cursor is no longer available.",
        });
      }
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ];
    }

    const results = await ChatMessage.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize + 1)
      .lean();
    const hasMore = results.length > pageSize;
    const messages = results.slice(0, pageSize).reverse();

    return res.json({
      success: true,
      messages: messages.map(serializeChatMessage),
      nextCursor: hasMore ? messages[0]._id.toString() : null,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
