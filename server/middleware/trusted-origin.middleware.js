export function requireTrustedOrigin(req, res, next) {
  const origin = req.get("origin");
  const clientOrigin = process.env.CLIENT_URL || "http://localhost:3000";

  if (!origin || origin === clientOrigin) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "This request origin is not allowed.",
  });
}
