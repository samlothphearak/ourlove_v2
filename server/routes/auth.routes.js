import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import User from "../models/User.js";
import {
  clearAuthCookie,
  createSessionToken,
  getSafeUser,
  requireAuth,
  setAuthCookie,
} from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/trusted-origin.middleware.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many sign-in attempts. Please try again later.",
    }),
});
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many profile updates. Please try again later.",
    }),
});
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordByteLimit = 72;
const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function uploadAvatar(buffer, userId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ourlove/avatars",
        public_id: userId.toString(),
        overwrite: true,
        invalidate: true,
        transformation: [
          { width: 512, height: 512, crop: "limit", quality: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) {
          return reject(new Error("Cloudinary did not return a secure image URL."));
        }
        return resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

function sendSession(res, user, status = 200) {
  const token = createSessionToken(user._id.toString());
  setAuthCookie(res, token);
  return res.status(status).json({
    success: true,
    user: getSafeUser(user),
  });
}

router.post(
  "/register",
  requireTrustedOrigin,
  authLimiter,
  async (req, res, next) => {
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters.",
      });
    }

    if (email.length > 254 || !emailPattern.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > passwordByteLimit
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and no more than 72 bytes.",
      });
    }

    try {
      const existingUser = await User.exists({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ name, email, passwordHash });
      return sendSession(res, user, 201);
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }
      return next(error);
    }
  },
);

router.post(
  "/login",
  requireTrustedOrigin,
  authLimiter,
  async (req, res, next) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!emailPattern.test(email) || password.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address and password.",
      });
    }

    try {
      const user = await User.findOne({ email }).select("+passwordHash");
      const passwordMatches =
        user && (await bcrypt.compare(password, user.passwordHash));

      if (!user || !passwordMatches) {
        return res.status(401).json({
          success: false,
          message: "Email or password is incorrect.",
        });
      }

      return sendSession(res, user);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/profile",
  requireAuth,
  requireTrustedOrigin,
  profileUpdateLimiter,
  async (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        message: "Provide profile fields to update.",
      });
    }

    const keys = Object.keys(body);
    if (
      keys.length === 0 ||
      keys.some(
        (key) => !["name", "currentPassword", "newPassword"].includes(key),
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Only name and password can be updated.",
      });
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : undefined;
    const hasCurrentPassword = Object.prototype.hasOwnProperty.call(
      body,
      "currentPassword",
    );
    const hasNewPassword = Object.prototype.hasOwnProperty.call(
      body,
      "newPassword",
    );
    if (
      (hasCurrentPassword && typeof body.currentPassword !== "string") ||
      (hasNewPassword && typeof body.newPassword !== "string")
    ) {
      return res.status(400).json({
        success: false,
        message: "Current and new passwords must be strings.",
      });
    }

    const currentPassword = hasCurrentPassword
      ? body.currentPassword
      : undefined;
    const newPassword = hasNewPassword ? body.newPassword : undefined;

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      if (!name || name.length < 2 || name.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Name must be between 2 and 50 characters.",
        });
      }
    }

    if (hasCurrentPassword !== hasNewPassword) {
      return res.status(400).json({
        success: false,
        message: "Enter both your current password and a new password.",
      });
    }
    if (!name && !hasCurrentPassword) {
      return res.status(400).json({
        success: false,
        message: "Provide a name or password to update.",
      });
    }
    if (
      hasNewPassword &&
      (newPassword.length < 8 ||
        Buffer.byteLength(newPassword, "utf8") > passwordByteLimit)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and no more than 72 bytes.",
      });
    }

    try {
      const user = await User.findById(req.authUser._id).select(
        "+passwordHash",
      );
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Your account could not be found.",
        });
      }

      if (hasCurrentPassword) {
        const passwordMatches = await bcrypt.compare(
          currentPassword,
          user.passwordHash,
        );
        if (!passwordMatches) {
          return res.status(400).json({
            success: false,
            message: "Current password is incorrect.",
          });
        }
        if (currentPassword === newPassword) {
          return res.status(400).json({
            success: false,
            message: "Choose a new password different from your current one.",
          });
        }
        user.passwordHash = await bcrypt.hash(newPassword, 12);
      }

      if (name) user.name = name;
      await user.save();

      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        user: getSafeUser(user),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.put(
  "/profile/avatar",
  requireAuth,
  requireTrustedOrigin,
  profileUpdateLimiter,
  express.raw({
    type: [...allowedAvatarTypes],
    limit: "5mb",
  }),
  async (req, res, next) => {
    const contentType = req.get("Content-Type")?.split(";")[0].trim();
    if (!contentType || !allowedAvatarTypes.has(contentType)) {
      return res.status(415).json({
        success: false,
        message: "Upload a JPEG, PNG, or WebP profile image.",
      });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Choose a profile image to upload.",
      });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Profile image upload is not configured on the server.",
      });
    }

    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });

      const user = await User.findById(req.authUser._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Your account could not be found.",
        });
      }

      user.profileImageUrl = await uploadAvatar(req.body, user._id);
      await user.save();

      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        user: getSafeUser(user),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get("/me", requireAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({
    success: true,
    user: getSafeUser(req.authUser),
  });
});

router.post("/logout", requireTrustedOrigin, (req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
});

export default router;
