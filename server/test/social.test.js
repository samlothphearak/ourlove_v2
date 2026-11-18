import assert from "node:assert/strict";
import { test } from "node:test";
import { canViewPost, getFriendshipKey } from "../lib/social.js";

test("friendship keys are stable regardless of request direction", () => {
  assert.deepEqual(getFriendshipKey("z-user", "a-user"), {
    userA: "a-user",
    userB: "z-user",
  });
  assert.deepEqual(getFriendshipKey("a-user", "z-user"), {
    userA: "a-user",
    userB: "z-user",
  });
});

test("post visibility respects public, friend, and private audiences", () => {
  const friends = new Set(["author-friend"]);
  const post = { author: "author", visibility: "public" };
  assert.equal(canViewPost("viewer", friends, post), true);
  assert.equal(
    canViewPost("viewer", friends, { ...post, visibility: "friends" }),
    false,
  );
  assert.equal(
    canViewPost("viewer", new Set(["author"]), {
      ...post,
      visibility: "friends",
    }),
    true,
  );
  assert.equal(
    canViewPost("viewer", new Set(["author"]), {
      ...post,
      visibility: "private",
    }),
    false,
  );
  assert.equal(
    canViewPost("author", new Set(), { ...post, visibility: "private" }),
    true,
  );
  assert.equal(
    canViewPost("viewer", new Set(), {
      author: null,
      visibility: "public",
    }),
    false,
  );
});

test("reposts never broaden the original post audience", () => {
  const repost = {
    author: "reposter",
    visibility: "friends",
    sharedFrom: {
      authorId: "original-author",
      visibility: "friends",
    },
  };

  assert.equal(
    canViewPost("viewer", new Set(["reposter"]), repost),
    false,
  );
  assert.equal(
    canViewPost(
      "viewer",
      new Set(["reposter", "original-author"]),
      repost,
    ),
    true,
  );
  assert.equal(
    canViewPost("original-author", new Set(["reposter"]), repost),
    true,
  );
});
