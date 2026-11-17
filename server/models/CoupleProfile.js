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
  },
  { timestamps: true },
);

coupleProfileSchema.index({ userA: 1, userB: 1 }, { unique: true });

const CoupleProfile =
  mongoose.models.CoupleProfile ||
  mongoose.model("CoupleProfile", coupleProfileSchema);

export default CoupleProfile;
