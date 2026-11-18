import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import ChatMessage from "../models/ChatMessage.js";
import Memory from "../models/Memory.js";
import User from "../models/User.js";
import { getPairContext } from "../routes/partner.routes.js";
import {
  getChatRoomId,
  getMemoryAttachment,
  markChatMessagesSeen,
  serializeChatMessage,
} from "../lib/chat.js";

test("chat conversations require a reciprocal partner connection", async (t) => {
  const originalFindById = User.findById;
  t.after(() => {
    User.findById = originalFindById;
  });

  const users = new Map([
    ["user-a", { _id: "user-a", partnerId: "user-b" }],
    ["user-b", { _id: "user-b", partnerId: "user-a" }],
  ]);
  User.findById = (userId) => ({
    select: async () => users.get(userId.toString()) || null,
  });

  const pair = await getPairContext("user-a");
  assert.equal(pair.status, "paired");
  assert.equal(
    getChatRoomId(pair.user._id, pair.partner._id),
    getChatRoomId(pair.partner._id, pair.user._id),
  );

  users.set("user-a", { _id: "user-a", partnerId: null });
  const unpairedContext = await getPairContext("user-a");
  assert.equal(unpairedContext.status, "unpaired");

  users.set("user-a", { _id: "user-a", partnerId: "user-b" });
  users.set("user-b", { _id: "user-b", partnerId: null });
  const inconsistentPair = await getPairContext("user-a");
  assert.equal(inconsistentPair.status, "inconsistent");
});

test("chat messages reject blank and overlong text", async () => {
  const sender = new mongoose.Types.ObjectId();
  const recipient = new mongoose.Types.ObjectId();
  const messageDetails = {
    conversationId: "chat:user-a:user-b",
    sender,
    recipient,
  };

  await assert.rejects(
    new ChatMessage({ ...messageDetails, text: "   " }).validate(),
  );
  await assert.rejects(
    new ChatMessage({ ...messageDetails, text: "a".repeat(2001) }).validate(),
  );
  await new ChatMessage({ ...messageDetails, text: " hello " }).validate();
});

test("chat memory attachments are limited to the active couple", async (t) => {
  const originalFindOne = Memory.findOne;
  t.after(() => {
    Memory.findOne = originalFindOne;
  });

  const memoryId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const partnerId = new mongoose.Types.ObjectId();
  const memory = {
    _id: memoryId,
    title: "Our trip",
    createdAt: new Date("2025-01-02T00:00:00.000Z"),
    imageUrl: "https://images.example.com/our-trip.jpg",
    category: "Travel",
    description: "A favorite day",
  };
  let filter;
  Memory.findOne = (query) => {
    filter = query;
    return {
      select: () => ({
        lean: async () => memory,
      }),
    };
  };

  const attachment = await getMemoryAttachment(memoryId, {
    user: { _id: userId },
    partner: { _id: partnerId },
  });

  assert.deepEqual(filter, {
    _id: memoryId,
    owner: { $in: [userId, partnerId] },
  });
  assert.equal(attachment.memoryId, memoryId);
  assert.equal(attachment.image, memory.imageUrl);

  Memory.findOne = () => ({
    select: () => ({
      lean: async () => null,
    }),
  });
  assert.equal(
    await getMemoryAttachment(memoryId, {
      user: { _id: userId },
      partner: { _id: partnerId },
    }),
    null,
  );
});

test("chat message serialization preserves an attached memory snapshot", () => {
  const memoryId = new mongoose.Types.ObjectId();
  const message = {
    _id: new mongoose.Types.ObjectId(),
    sender: new mongoose.Types.ObjectId(),
    recipient: new mongoose.Types.ObjectId(),
    text: "Remember this day?",
    seenAt: new Date("2025-01-03T00:01:00.000Z"),
    memory: {
      memoryId,
      title: "Our trip",
      date: new Date("2025-01-02T00:00:00.000Z"),
      image: "https://images.example.com/our-trip.jpg",
      category: "Travel",
      description: "A favorite day",
    },
    createdAt: new Date("2025-01-03T00:00:00.000Z"),
  };

  assert.deepEqual(serializeChatMessage(message).memory, {
    id: memoryId.toString(),
    title: "Our trip",
    date: "2025-01-02T00:00:00.000Z",
    image: "https://images.example.com/our-trip.jpg",
    category: "Travel",
    description: "A favorite day",
  });
  assert.equal(serializeChatMessage(message).seenAt, "2025-01-03T00:01:00.000Z");
});

test("chat read receipts update only unread messages for the recipient", async (t) => {
  const originalFindOne = ChatMessage.findOne;
  const originalUpdateMany = ChatMessage.updateMany;
  t.after(() => {
    ChatMessage.findOne = originalFindOne;
    ChatMessage.updateMany = originalUpdateMany;
  });

  const messageId = new mongoose.Types.ObjectId();
  const createdAt = new Date("2025-01-03T00:00:00.000Z");
  const recipientId = new mongoose.Types.ObjectId();
  let unreadFilter;
  let updateFilter;
  ChatMessage.findOne = (filter) => {
    unreadFilter = filter;
    return {
      sort: () => ({
        select: () => ({
          lean: async () => ({ _id: messageId, createdAt }),
        }),
      }),
    };
  };
  ChatMessage.updateMany = async (filter) => {
    updateFilter = filter;
    return { modifiedCount: 2 };
  };

  const receipt = await markChatMessagesSeen("chat:pair", recipientId);
  assert.deepEqual(unreadFilter, {
    conversationId: "chat:pair",
    recipient: recipientId,
    seenAt: null,
  });
  assert.equal(updateFilter.conversationId, "chat:pair");
  assert.equal(updateFilter.recipient, recipientId);
  assert.equal(updateFilter.seenAt, null);
  assert.equal(receipt.throughMessageId, messageId.toString());
  assert.ok(Number.isFinite(Date.parse(receipt.seenAt)));
});
