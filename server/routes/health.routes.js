import { Router } from "express";
import { getDatabaseStatus } from "../config/database.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "OurLove API is running ❤️",
    database: getDatabaseStatus(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
