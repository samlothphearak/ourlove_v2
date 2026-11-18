import mongoose from "mongoose";

const memoryAttachmentSchema = new mongoose.Schema(
  {
    memoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Memory",
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    date: { type: Date, required: true },
    image: { type: String, required: true, maxlength: 2048 },
    category: { type: String, default: "Together", maxlength: 40 },
    description: { type: String, default: "", maxlength: 1000 },
  },
  { _id: false },
);

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    seenAt: {
      type: Date,
      default: null,
    },
    memory: {
      type: memoryAttachmentSchema,
      default: null,
    },
  },
  { timestamps: true },
);

chatMessageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
chatMessageSchema.index({
  conversationId: 1,
  recipient: 1,
  seenAt: 1,
  createdAt: -1,
  _id: -1,
});

const ChatMessage =
  mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", chatMessageSchema);

export default ChatMessage;
