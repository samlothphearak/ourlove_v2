import { Router } from "express";
import rateLimit from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import multer from "multer";
import Memory from "../models/Memory.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/trusted-origin.middleware.js";

const router = Router();
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedCategories = new Set(["Travel", "Dates", "Outdoors", "Together"]);
const memoryWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many memory updates. Please try again later.",
    }),
});
const memoryImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 3,
    fieldSize: 1000,
  },
  fileFilter: (req, file, callback) =>
    callback(null, allowedImageTypes.has(file.mimetype)),
});

export async function getMemoryOwnerIds(user) {
  if (!user.partnerId) return [user._id];

  const partner = await User.findOne({
    _id: user.partnerId,
    partnerId: user._id,
  })
    .select("_id")
    .lean();

  return partner ? [user._id, partner._id] : [user._id];
}

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function serializeMemory(memory, userId) {
  const likedBy = memory.likedBy || [];
  const userIdString = userId.toString();

  return {
    id: memory._id.toString(),
    title: memory.title,
    date: memory.createdAt.toISOString(),
    image: memory.imageUrl,
    category: memory.category || "Together",
    description: memory.description || "",
    likesCount: likedBy.length,
    likedByMe: likedBy.some((id) => id.toString() === userIdString),
  };
}

function uploadMemoryImage(buffer, ownerId, memoryId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ourlove/memories",
        public_id: `${ownerId}/${memoryId}`,
        overwrite: false,
        transformation: [
          { width: 1600, height: 1600, crop: "limit", quality: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result.public_id) {
          return reject(
            new Error("Cloudinary did not return a secure memory image."),
          );
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

router.get("/recent", requireAuth, async (req, res, next) => {
  try {
    const ownerIds = await getMemoryOwnerIds(req.authUser);
    const memories = await Memory.find({ owner: { $in: ownerIds } })
      .sort({ createdAt: -1 })
      .limit(2)
      .select("title imageUrl category description likedBy createdAt")
      .lean();

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      memories: memories.map((memory) => ({
        ...serializeMemory(memory, req.authUser._id),
        type: memory.category || "Together",
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const ownerIds = await getMemoryOwnerIds(req.authUser);
    const memories = await Memory.find({ owner: { $in: ownerIds } })
      .sort({ createdAt: -1 })
      .select("title imageUrl category description likedBy createdAt")
      .lean();

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      memories: memories.map((memory) =>
        serializeMemory(memory, req.authUser._id),
      ),
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/",
  requireAuth,
  requireTrustedOrigin,
  memoryWriteLimiter,
  memoryImageUpload.single("image"),
  async (req, res, next) => {
    if (
      (req.body?.title !== undefined && typeof req.body.title !== "string") ||
      (req.body?.category !== undefined &&
        typeof req.body.category !== "string") ||
      (req.body?.description !== undefined &&
        typeof req.body.description !== "string")
    ) {
      return res.status(400).json({
        success: false,
        message: "Memory fields must be text.",
      });
    }

    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const category =
      typeof req.body?.category === "string"
        ? req.body.category.trim()
        : "Together";
    const description =
      typeof req.body?.description === "string"
        ? req.body.description.trim()
        : "";

    if (!title || title.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Memory titles must be between 1 and 120 characters.",
      });
    }
    if (!allowedCategories.has(category)) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid memory category.",
      });
    }
    if (description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Memory notes must be 1000 characters or fewer.",
      });
    }
    if (!req.file) {
      return res.status(415).json({
        success: false,
        message: "Choose a JPEG, PNG, or WebP memory photo.",
      });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Memory photo uploads are not configured on the server.",
      });
    }

    const memoryId = new mongoose.Types.ObjectId();
    let uploadedImage;

    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });

      uploadedImage = await uploadMemoryImage(
        req.file.buffer,
        req.authUser._id,
        memoryId,
      );
      const memory = await Memory.create({
        _id: memoryId,
        owner: req.authUser._id,
        title,
        imageUrl: uploadedImage.imageUrl,
        category,
        description,
      });

      res.set("Cache-Control", "no-store");
      return res.status(201).json({
        success: true,
        memory: serializeMemory(memory, req.authUser._id),
      });
    } catch (error) {
      if (uploadedImage?.publicId) {
        try {
          await cloudinary.uploader.destroy(uploadedImage.publicId);
        } catch (cleanupError) {
          console.error(
            "Could not remove an unlinked memory image:",
            cleanupError?.name || "Error",
          );
        }
      }
      return next(error);
    }
  },
);

router.put(
  "/:id/like",
  requireAuth,
  requireTrustedOrigin,
  memoryWriteLimiter,
  async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory identifier.",
      });
    }

    try {
      const ownerIds = await getMemoryOwnerIds(req.authUser);
      const memory = await Memory.findOneAndUpdate(
        { _id: req.params.id, owner: { $in: ownerIds } },
        { $addToSet: { likedBy: req.authUser._id } },
        { new: true },
      )
        .select("title imageUrl category description likedBy createdAt")
        .lean();
      if (!memory) {
        return res.status(404).json({
          success: false,
          message: "Memory not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        memory: serializeMemory(memory, req.authUser._id),
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
  memoryWriteLimiter,
  async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory identifier.",
      });
    }

    try {
      const ownerIds = await getMemoryOwnerIds(req.authUser);
      const memory = await Memory.findOneAndUpdate(
        { _id: req.params.id, owner: { $in: ownerIds } },
        { $pull: { likedBy: req.authUser._id } },
        { new: true },
      )
        .select("title imageUrl category description likedBy createdAt")
        .lean();
      if (!memory) {
        return res.status(404).json({
          success: false,
          message: "Memory not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        memory: serializeMemory(memory, req.authUser._id),
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
