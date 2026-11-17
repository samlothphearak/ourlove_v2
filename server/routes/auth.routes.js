import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
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
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordByteLimit = 72;

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
