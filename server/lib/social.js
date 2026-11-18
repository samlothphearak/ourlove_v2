import Friendship from "../models/Friendship.js";

export function getFriendshipKey(userA, userB) {
  const [first, second] = [userA.toString(), userB.toString()].sort();
  return { userA: first, userB: second };
}

export async function getAcceptedFriendIds(userId) {
  const friendships = await Friendship.find({
    status: "accepted",
    $or: [{ userA: userId }, { userB: userId }],
  })
    .select("userA userB")
    .lean();

  return friendships.map((friendship) =>
    friendship.userA.toString() === userId.toString()
      ? friendship.userB.toString()
      : friendship.userA.toString(),
  );
}

function isVisibleTo(viewerId, friendIds, authorId, visibility) {
  const author = authorId.toString();
  if (author === viewerId.toString() || visibility === "public") return true;
  return visibility === "friends" && friendIds.has(author);
}

export function canViewPost(viewerId, friendIds, post) {
  const authorId = post.author?._id || post.author;
  if (!authorId) return false;
  if (!isVisibleTo(viewerId, friendIds, authorId, post.visibility)) {
    return false;
  }

  if (!post.sharedFrom) return true;
  return isVisibleTo(
    viewerId,
    friendIds,
    post.sharedFrom.authorId,
    post.sharedFrom.visibility,
  );
}
