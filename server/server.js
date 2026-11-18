import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { connectDatabase } from "./config/database.js";
import ChatMessage from "./models/ChatMessage.js";
import User from "./models/User.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import memoryRoutes from "./routes/memory.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import friendsRoutes from "./routes/friends.routes.js";
import postsRoutes from "./routes/posts.routes.js";
import partnerRoutes, { getPairContext } from "./routes/partner.routes.js";
import { getSessionToken } from "./middleware/auth.middleware.js";
import {
  getChatRoomId,
  getMemoryAttachment,
  markChatMessagesSeen,
  serializeChatMessage,
} from "./lib/chat.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(helmet());

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    name: "OurLove API",
    version: "1.0.0",
    status: "online",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/memories", memoryRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/posts", postsRoutes);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

io.use(async (socket, next) => {
  const token = getSessionToken({ headers: socket.handshake.headers });
  if (!token) return next(new Error("AUTH_REQUIRED"));

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new Error("AUTH_REQUIRED"));
  }
  if (typeof payload === "string" || typeof payload.sub !== "string") {
    return next(new Error("AUTH_REQUIRED"));
  }

  try {
    const pair = await getPairContext(payload.sub);
    if (pair.status !== "paired") {
      return next(new Error("PARTNER_REQUIRED"));
    }

    socket.data.userId = pair.user._id.toString();
    socket.data.partnerId = pair.partner._id.toString();
    socket.data.partnerLastSeenAt = pair.partner.lastSeenAt
      ? pair.partner.lastSeenAt.toISOString()
      : null;
    return next();
  } catch (error) {
    console.error("Chat socket authentication failed:", error?.name || "Error");
    return next(new Error("CHAT_UNAVAILABLE"));
  }
});

const onlineCounts = new Map();
const getPresenceKey = (room, userId) => `${room}:${userId}`;

io.on("connection", (socket) => {
  const { userId, partnerId } = socket.data;
  const room = getChatRoomId(userId, partnerId);
  const userPresenceKey = getPresenceKey(room, userId);
  const partnerPresenceKey = getPresenceKey(room, partnerId);
  const userConnections = onlineCounts.get(userPresenceKey) || 0;

  socket.join(room);
  onlineCounts.set(userPresenceKey, userConnections + 1);
  socket.emit("chat:presence", {
    userId: partnerId,
    isOnline: (onlineCounts.get(partnerPresenceKey) || 0) > 0,
    lastSeenAt:
      (onlineCounts.get(partnerPresenceKey) || 0) > 0
        ? null
        : socket.data.partnerLastSeenAt,
  });
  if (userConnections === 0) {
    socket.to(room).emit("chat:presence", {
      userId,
      isOnline: true,
      lastSeenAt: null,
    });
  }

  socket.on("chat:send", (payload, acknowledge) => {
    const ack = typeof acknowledge === "function" ? acknowledge : () => {};
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    const requestedMemoryId = payload?.memoryId;
    if (!text || text.length > 2000) {
      return ack({
        success: false,
        message: "Messages must be between 1 and 2000 characters.",
      });
    }
    if (
      requestedMemoryId !== undefined &&
      requestedMemoryId !== null &&
      (typeof requestedMemoryId !== "string" ||
        !mongoose.isObjectIdOrHexString(requestedMemoryId))
    ) {
      return ack({
        success: false,
        message: "The selected memory is invalid.",
      });
    }

    const now = Date.now();
    const window = socket.data.chatSendWindow;
    if (!window || now - window.startedAt >= 60_000) {
      socket.data.chatSendWindow = { startedAt: now, count: 0 };
    }
    if (socket.data.chatSendWindow.count >= 60) {
      return ack({
        success: false,
        message: "You are sending messages too quickly. Please wait a moment.",
      });
    }
    socket.data.chatSendWindow.count += 1;

    void (async () => {
      const pair = await getPairContext(userId);
      if (
        pair.status !== "paired" ||
        pair.partner._id.toString() !== partnerId
      ) {
        socket.emit("chat:unavailable");
        socket.disconnect(true);
        return ack({
          success: false,
          message: "Your partner connection is no longer active.",
        });
      }

      const memory = requestedMemoryId
        ? await getMemoryAttachment(requestedMemoryId, pair)
        : null;
      if (requestedMemoryId && !memory) {
        return ack({
          success: false,
          message: "That memory is no longer available to share in chat.",
        });
      }

      const message = await ChatMessage.create({
        conversationId: room,
        sender: userId,
        recipient: partnerId,
        text,
        memory,
      });
      io.to(room).emit("chat:message", serializeChatMessage(message));
      return ack({ success: true });
    })().catch((error) => {
      console.error("Chat message could not be saved:", error?.name || "Error");
      ack({
        success: false,
        message: "Message could not be sent. Please try again.",
      });
    });
  });

  socket.on("chat:mark_seen", (acknowledge) => {
    const ack = typeof acknowledge === "function" ? acknowledge : () => {};

    void (async () => {
      const pair = await getPairContext(userId);
      if (
        pair.status !== "paired" ||
        pair.partner._id.toString() !== partnerId
      ) {
        socket.emit("chat:unavailable");
        socket.disconnect(true);
        return ack({
          success: false,
          message: "Your partner connection is no longer active.",
        });
      }

      const receipt = await markChatMessagesSeen(room, userId);
      if (receipt) {
        io.to(room).emit("chat:seen", {
          readerId: userId,
          ...receipt,
        });
      }
      return ack({ success: true, seen: Boolean(receipt) });
    })().catch((error) => {
      console.error(
        "Chat seen status could not be saved:",
        error?.name || "Error",
      );
      ack({
        success: false,
        message: "Unable to update read status.",
      });
    });
  });

  socket.on("disconnect", () => {
    const remainingConnections = (onlineCounts.get(userPresenceKey) || 1) - 1;
    if (remainingConnections > 0) {
      onlineCounts.set(userPresenceKey, remainingConnections);
      return;
    }
    onlineCounts.delete(userPresenceKey);
    const lastSeenAt = new Date();
    io.to(room).emit("chat:presence", {
      userId,
      isOnline: false,
      lastSeenAt: lastSeenAt.toISOString(),
    });
    void User.updateOne({ _id: userId }, { $set: { lastSeenAt } }).catch(
      (error) => {
        console.error(
          "User last-seen time could not be saved:",
          error?.name || "Error",
        );
      },
    );
  });
});

app.use((error, req, res, next) => {
  const isInvalidJson = error?.type === "entity.parse.failed";
  const isTooLarge = error?.type === "entity.too.large";
  const isInvalidUpload = error?.name === "MulterError";
  const isUploadTooLarge = error?.code === "LIMIT_FILE_SIZE";
  if (!isInvalidJson && !isInvalidUpload) {
    console.error(
      "API request failed:",
      req.method,
      req.originalUrl,
      error?.name || "Error",
    );
  }
  res
    .status(
      isInvalidJson
        ? 400
        : isTooLarge || isUploadTooLarge
          ? 413
          : isInvalidUpload
            ? 400
            : 500,
    )
    .json({
      success: false,
      message: isInvalidJson
        ? "Request body must be valid JSON."
        : isTooLarge || isUploadTooLarge
          ? "Uploaded file is too large."
          : isInvalidUpload
            ? "The photo upload could not be processed."
            : "An unexpected server error occurred.",
    });
});

async function startServer() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }
    await connectDatabase();

    server.listen(PORT, () => {
      console.log(`OurLove API: http://localhost:${PORT}`);
      console.log(`Socket.IO is ready`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
