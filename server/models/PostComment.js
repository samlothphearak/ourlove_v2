import mongoose from "mongoose";

const postCommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

postCommentSchema.index({ post: 1, createdAt: -1, _id: -1 });

const PostComment =
  mongoose.models.PostComment ||
  mongoose.model("PostComment", postCommentSchema);

export default PostComment;
