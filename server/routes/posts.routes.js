import { Router } from "express";
import rateLimit from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import multer from "multer";
import FeedPost from "../models/FeedPost.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/trusted-origin.middleware.js";
import { canViewPost, getAcceptedFriendIds } from "../lib/social.js";

const router = Router();
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const visibilityValues = new Set(["public", "friends", "private"]);
const pageSize = 20;
const commentPageSize = 50;
const postWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const engagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 2,
    fieldSize: 2048,
  },
  fileFilter: (req, file, callback) =>
    callback(null, allowedImageTypes.has(file.mimetype)),
});

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function uploadPostImage(buffer, ownerId, postId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ourlove/posts",
        public_id: `${ownerId}/${postId}`,
        overwrite: false,
        transformation: [
          { width: 1600, height: 1600, crop: "limit", quality: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result.public_id) {
          return reject(new Error("Cloudinary did not return a secure post image."));
        }
        return resolve({
          imageUrl: result.secure_url,
          publicId: result.public_id,
        });
      },
    );
    stream.end(buffer);
  });
}

function serializeUser(user) {
  return user
    ? {
        id: user._id.toString(),
        name: user.name,
        profileImageUrl: user.profileImageUrl || null,
      }
    : null;
}

function serializePost(post, likedIds = new Set()) {
  return {
    id: post._id.toString(),
    author: serializeUser(post.author),
    image: post.imageUrl,
    caption: post.caption || "",
    visibility: post.visibility,
    createdAt: post.createdAt.toISOString(),
    likesCount: post.likesCount || 0,
    commentsCount: post.commentsCount || 0,
    sharesCount: post.sharesCount || 0,
    likedByMe: likedIds.has(post._id.toString()),
    sharedFrom: post.sharedFrom
      ? {
          id: post.sharedFrom.postId.toString(),
          authorId: post.sharedFrom.authorId.toString(),
          authorName: post.sharedFrom.authorName,
          caption: post.sharedFrom.caption || "",
        }
      : null,
  };
}

function serializeComment(comment) {
  return {
    id: comment._id.toString(),
    author: serializeUser(comment.author),
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
  };
}

async function getVisiblePost(postId, userId, friendIds) {
  const post = await FeedPost.findById(postId)
    .populate("author", "name profileImageUrl")
    .lean();
  return post && canViewPost(userId, friendIds, post) ? post : null;
}

function cursorFilter(cursor) {
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
    ],
  };
}

router.post(
  "/",
  requireAuth,
  requireTrustedOrigin,
  postWriteLimiter,
  photoUpload.single("image"),
  async (req, res, next) => {
    const caption =
      typeof req.body?.caption === "string" ? req.body.caption.trim() : "";
    const visibility =
      typeof req.body?.visibility === "string" ? req.body.visibility : "";
    if (
      (req.body?.caption !== undefined &&
        typeof req.body.caption !== "string") ||
      caption.length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Captions must be 500 characters or fewer.",
      });
    }
    if (!visibilityValues.has(visibility)) {
      return res.status(400).json({
        success: false,
        message: "Choose Public, Friends, or Only me.",
      });
    }
    if (!req.file) {
      return res.status(415).json({
        success: false,
        message: "Choose a JPEG, PNG, or WebP photo.",
      });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Photo uploads are not configured on the server.",
      });
    }

    const postId = new mongoose.Types.ObjectId();
    let uploadedImage;
    let postCreated = false;
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
      uploadedImage = await uploadPostImage(
        req.file.buffer,
        req.authUser._id,
        postId,
      );
      await FeedPost.create({
        _id: postId,
        author: req.authUser._id,
        imageUrl: uploadedImage.imageUrl,
        caption,
        visibility,
      });
      postCreated = true;
      const post = await FeedPost.findById(postId)
        .populate("author", "name profileImageUrl")
        .lean();

      res.set("Cache-Control", "no-store");
      return res.status(201).json({
        success: true,
        post: serializePost(post),
      });
    } catch (error) {
      if (uploadedImage?.publicId && !postCreated) {
        try {
          await cloudinary.uploader.destroy(uploadedImage.publicId);
        } catch (cleanupError) {
          console.error(
            "Could not remove an unlinked post image:",
            cleanupError?.name || "Error",
          );
        }
      }
      return next(error);
    }
  },
);

router.get("/feed", requireAuth, async (req, res, next) => {
  const before = req.query.before;
  if (
    before !== undefined &&
    (typeof before !== "string" || !mongoose.isObjectIdOrHexString(before))
  ) {
    return res.status(400).json({
      success: false,
      message: "The feed cursor is invalid.",
    });
  }

  try {
    const userId = req.authUser._id;
    const friendIds = new Set(await getAcceptedFriendIds(userId));
    const cursor = before
      ? await FeedPost.findById(before).select("_id createdAt").lean()
      : null;
    if (before && !cursor) {
      return res.status(400).json({
        success: false,
        message: "The feed cursor is no longer available.",
      });
    }

    const candidateFilter = {
      $or: [
        { author: userId },
        { visibility: "public" },
        { visibility: "friends", author: { $in: [...friendIds] } },
      ],
    };
    const visiblePosts = [];
    let scanCursor = cursor;
    let exhausted = false;
    while (visiblePosts.length <= pageSize && !exhausted) {
      const filters = [candidateFilter];
      if (scanCursor) filters.push(cursorFilter(scanCursor));
      const batch = await FeedPost.find({ $and: filters })
        .sort({ createdAt: -1, _id: -1 })
        .limit(50)
        .populate("author", "name profileImageUrl")
        .lean();
      if (batch.length === 0) {
        exhausted = true;
        break;
      }

      for (const post of batch) {
        scanCursor = { _id: post._id, createdAt: post.createdAt };
        if (canViewPost(userId, friendIds, post)) visiblePosts.push(post);
        if (visiblePosts.length > pageSize) break;
      }
      if (batch.length < 50) exhausted = true;
    }

    const hasMore = visiblePosts.length > pageSize;
    const posts = visiblePosts.slice(0, pageSize);
    const likedPosts = posts.length
      ? await PostLike.find({
          user: userId,
          post: { $in: posts.map((post) => post._id) },
        })
          .select("post")
          .lean()
      : [];
    const likedIds = new Set(likedPosts.map((like) => like.post.toString()));

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      posts: posts.map((post) => serializePost(post, likedIds)),
      nextCursor: hasMore ? posts[posts.length - 1]._id.toString() : null,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/comments", requireAuth, async (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(404).json({
      success: false,
      message: "Post not found.",
    });
  }
  const before = req.query.before;
  if (
    before !== undefined &&
    (typeof before !== "string" || !mongoose.isObjectIdOrHexString(before))
  ) {
    return res.status(400).json({
      success: false,
      message: "The comments cursor is invalid.",
    });
  }

  try {
    const friendIds = new Set(await getAcceptedFriendIds(req.authUser._id));
    const post = await getVisiblePost(
      req.params.id,
      req.authUser._id,
      friendIds,
    );
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    const commentFilter = { post: post._id };
    if (before) {
      const cursor = await PostComment.findOne({
        _id: before,
        post: post._id,
      })
        .select("_id createdAt")
        .lean();
      if (!cursor) {
        return res.status(400).json({
          success: false,
          message: "The comments cursor is no longer available.",
        });
      }
      Object.assign(commentFilter, cursorFilter(cursor));
    }
    const results = await PostComment.find(commentFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(commentPageSize + 1)
      .populate("author", "name profileImageUrl")
      .lean();
    const hasMore = results.length > commentPageSize;
    const comments = results.slice(0, commentPageSize).reverse();

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      comments: comments.map(serializeComment),
      nextCursor: hasMore ? comments[0]._id.toString() : null,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/:id/comments",
  requireAuth,
  requireTrustedOrigin,
  engagementLimiter,
  async (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Comments must be between 1 and 1000 characters.",
      });
    }

    try {
      const friendIds = new Set(await getAcceptedFriendIds(req.authUser._id));
      const post = await getVisiblePost(
        req.params.id,
        req.authUser._id,
        friendIds,
      );
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found.",
        });
      }

      const comment = await PostComment.create({
        post: post._id,
        author: req.authUser._id,
        text,
      });
      await FeedPost.updateOne(
        { _id: post._id },
        { $inc: { commentsCount: 1 } },
      );
      res.set("Cache-Control", "no-store");
      return res.status(201).json({
        success: true,
        comment: {
          id: comment._id.toString(),
          author: serializeUser(req.authUser),
          text: comment.text,
          createdAt: comment.createdAt.toISOString(),
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.put(
  "/:id/like",
  requireAuth,
  requireTrustedOrigin,
  engagementLimiter,
  async (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    try {
      const userId = req.authUser._id;
      const friendIds = new Set(await getAcceptedFriendIds(userId));
      const post = await getVisiblePost(req.params.id, userId, friendIds);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found.",
        });
      }

      try {
        const result = await PostLike.updateOne(
          { post: post._id, user: userId },
          { $setOnInsert: { post: post._id, user: userId } },
          { upsert: true },
        );
        if (result.upsertedCount > 0) {
          await FeedPost.updateOne(
            { _id: post._id },
            { $inc: { likesCount: 1 } },
          );
        }
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }

      const updatedPost = await getVisiblePost(req.params.id, userId, friendIds);
      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        post: serializePost(updatedPost, new Set([req.params.id])),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/:id/like",
  requireAuth,
  requireTrustedOrigin,
  engagementLimiter,
  async (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    try {
      const userId = req.authUser._id;
      const friendIds = new Set(await getAcceptedFriendIds(userId));
      const post = await getVisiblePost(req.params.id, userId, friendIds);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found.",
        });
      }

      const result = await PostLike.deleteOne({ post: post._id, user: userId });
      if (result.deletedCount > 0) {
        await FeedPost.updateOne(
          { _id: post._id, likesCount: { $gt: 0 } },
          { $inc: { likesCount: -1 } },
        );
      }
      const updatedPost = await getVisiblePost(req.params.id, userId, friendIds);
      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        post: serializePost(updatedPost),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/share",
  requireAuth,
  requireTrustedOrigin,
  postWriteLimiter,
  async (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    try {
      const userId = req.authUser._id;
      const friendIds = new Set(await getAcceptedFriendIds(userId));
      const source = await getVisiblePost(req.params.id, userId, friendIds);
      if (!source) {
        return res.status(404).json({
          success: false,
          message: "Post not found.",
        });
      }

      const originalId = source.sharedFrom?.postId || source._id;
      const original = await FeedPost.findById(originalId)
        .populate("author", "name profileImageUrl")
        .lean();
      if (!original || !canViewPost(userId, friendIds, original)) {
        return res.status(404).json({
          success: false,
          message: "The original post is no longer available to share.",
        });
      }

      const originalAuthor = original.author;
      const sharedPost = await FeedPost.create({
        author: userId,
        imageUrl: original.imageUrl,
        caption: "",
        visibility: original.visibility,
        sharedFrom: {
          postId: original._id,
          authorId: originalAuthor._id,
          authorName: originalAuthor.name,
          caption: original.caption,
          visibility: original.visibility,
        },
      });
      await FeedPost.updateOne(
        { _id: original._id },
        { $inc: { sharesCount: 1 } },
      );

      const post = await FeedPost.findById(sharedPost._id)
        .populate("author", "name profileImageUrl")
        .lean();
      res.set("Cache-Control", "no-store");
      return res.status(201).json({
        success: true,
        post: serializePost(post),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get("/:id", requireAuth, async (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(404).json({
      success: false,
      message: "Post not found.",
    });
  }

  try {
    const userId = req.authUser._id;
    const friendIds = new Set(await getAcceptedFriendIds(userId));
    const post = await getVisiblePost(req.params.id, userId, friendIds);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }
    const liked = await PostLike.exists({ post: post._id, user: userId });
    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      post: serializePost(
        post,
        liked ? new Set([post._id.toString()]) : new Set(),
      ),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
