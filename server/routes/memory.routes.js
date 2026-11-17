import { Router } from "express";
import Memory from "../models/Memory.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/recent", requireAuth, async (req, res, next) => {
  try {
    const memories = await Memory.find({ owner: req.authUser._id })
      .sort({ createdAt: -1 })
      .limit(2)
      .select("title imageUrl category createdAt")
      .lean();

    return res.json({
      success: true,
      memories: memories.map((memory) => ({
        id: memory._id.toString(),
        title: memory.title,
        date: memory.createdAt.toISOString(),
        image: memory.imageUrl,
        type: memory.category || "Together",
      })),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
