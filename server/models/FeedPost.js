import mongoose from "mongoose";

const sharedFromSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      maxlength: 50,
    },
    caption: {
      type: String,
      default: "",
      maxlength: 500,
    },
    visibility: {
      type: String,
      enum: ["public", "friends", "private"],
      required: true,
    },
  },
  { _id: false },
);

const feedPostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
      maxlength: 2048,
      match: /^https?:\/\/\S+$/i,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    visibility: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public",
      required: true,
    },
    sharedFrom: {
      type: sharedFromSchema,
      default: null,
    },
    likesCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    commentsCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    sharesCount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true },
);

feedPostSchema.index({ visibility: 1, createdAt: -1, _id: -1 });
feedPostSchema.index({ author: 1, createdAt: -1, _id: -1 });

const FeedPost =
  mongoose.models.FeedPost || mongoose.model("FeedPost", feedPostSchema);

export default FeedPost;
