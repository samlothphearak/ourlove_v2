import mongoose from "mongoose";

const memorySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
      match: /^https?:\/\/\S+$/i,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "Together",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    likedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true },
);

memorySchema.index({ owner: 1, createdAt: -1 });

const Memory = mongoose.models.Memory || mongoose.model("Memory", memorySchema);

export default Memory;
