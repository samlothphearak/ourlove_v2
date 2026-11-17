export function getChatRoomId(userA, userB) {
  const [firstUserId, secondUserId] = [userA.toString(), userB.toString()]
    .sort();
  return `chat:${firstUserId}:${secondUserId}`;
}

export function serializeChatMessage(message) {
  return {
    id: message._id.toString(),
    senderId: message.sender.toString(),
    recipientId: message.recipient.toString(),
    text: message.text,
    createdAt: message.createdAt.toISOString(),
  };
}
