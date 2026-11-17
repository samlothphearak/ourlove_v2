import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const AUTH_COOKIE_NAME = "ourlove_session";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }
  return secret;
}

export function getSessionToken(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));

  return cookie ? cookie.slice(AUTH_COOKIE_NAME.length + 1) : null;
}

export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

export function clearAuthCookie(res) {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

export async function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Please sign in to continue.",
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({
      success: false,
      message: "Your session has expired. Please sign in again.",
    });
  }

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    clearAuthCookie(res);
    return res.status(401).json({
      success: false,
      message: "Your session is invalid. Please sign in again.",
    });
  }

  const user = await User.findById(payload.sub).select(
    "_id name email profileImageUrl partnerId",
  );
  if (!user) {
    clearAuthCookie(res);
    return res.status(401).json({
      success: false,
      message: "Your account is no longer available.",
    });
  }

  req.authUser = user;
  return next();
}

export function getSafeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    profileImageUrl: user.profileImageUrl || null,
  };
}

export function createSessionToken(userId) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn });
}
