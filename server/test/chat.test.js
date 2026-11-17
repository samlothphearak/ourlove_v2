import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import ChatMessage from "../models/ChatMessage.js";
import User from "../models/User.js";
import { getPairContext } from "../routes/partner.routes.js";
import { getChatRoomId } from "../lib/chat.js";

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
