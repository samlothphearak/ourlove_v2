import ChatMessage from "../models/ChatMessage.js";
import Memory from "../models/Memory.js";

export function getChatRoomId(userA, userB) {
  const [firstUserId, secondUserId] = [userA.toString(), userB.toString()]
    .sort();
  return `chat:${firstUserId}:${secondUserId}`;
}

export async function getMemoryAttachment(memoryId, pair) {
  const memory = await Memory.findOne({
    _id: memoryId,
    owner: { $in: [pair.user._id, pair.partner._id] },
  })
    .select("_id title createdAt imageUrl category description")
    .lean();

  if (!memory) return null;
  return {
    memoryId: memory._id,
    title: memory.title,
    date: memory.createdAt,
    image: memory.imageUrl,
    category: memory.category || "Together",
    description: memory.description || "",
  };
}

export async function markChatMessagesSeen(conversationId, recipientId) {
  const latestUnread = await ChatMessage.findOne({
    conversationId,
    recipient: recipientId,
    seenAt: null,
  })
    .sort({ createdAt: -1, _id: -1 })
    .select("_id createdAt")
    .lean();
  if (!latestUnread) return null;

  const seenAt = new Date();
  const update = await ChatMessage.updateMany(
    {
      conversationId,
      recipient: recipientId,
      seenAt: null,
      $or: [
        { createdAt: { $lt: latestUnread.createdAt } },
        {
          createdAt: latestUnread.createdAt,
          _id: { $lte: latestUnread._id },
        },
      ],
    },
    { $set: { seenAt } },
  );
  if (update.modifiedCount === 0) return null;

  return {
    throughMessageId: latestUnread._id.toString(),
    seenAt: seenAt.toISOString(),
  };
}

export function serializeChatMessage(message) {
  return {
    id: message._id.toString(),
    senderId: message.sender.toString(),
    recipientId: message.recipient.toString(),
    text: message.text,
    seenAt: message.seenAt ? message.seenAt.toISOString() : null,
    memory: message.memory
      ? {
          id: message.memory.memoryId.toString(),
          title: message.memory.title,
          date: message.memory.date.toISOString(),
          image: message.memory.image,
          category: message.memory.category,
          description: message.memory.description,
        }
      : null,
    createdAt: message.createdAt.toISOString(),
  };
}
