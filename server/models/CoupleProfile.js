import mongoose from "mongoose";

const coupleProfileSchema = new mongoose.Schema(
  {
    userA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    anniversaryDate: {
      type: String,
      default: null,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    loveNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    unlinkedAt: {
      type: Date,
      default: null,
    },
    deletionCodeHash: {
      type: String,
      default: null,
      select: false,
    },
    deletionConfirmedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
  },
  { timestamps: true },
);

coupleProfileSchema.index({ userA: 1, userB: 1 }, { unique: true });
coupleProfileSchema.index({ userA: 1, unlinkedAt: 1, updatedAt: -1 });
coupleProfileSchema.index({ userB: 1, unlinkedAt: 1, updatedAt: -1 });

const CoupleProfile =
  mongoose.models.CoupleProfile ||
  mongoose.model("CoupleProfile", coupleProfileSchema);

export default CoupleProfile;
