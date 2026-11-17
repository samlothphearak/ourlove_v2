import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { connectDatabase } from "./config/database.js";
import healthRoutes from "./routes/health.routes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(helmet());

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    name: "OurLove API",
    version: "1.0.0",
    status: "online",
  });
});

app.use("/api/health", healthRoutes);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Basic socket connection test.
// Private messaging and authentication come in later phases.
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

async function startServer() {
  try {
    await connectDatabase();

    server.listen(PORT, () => {
      console.log(`OurLove API: http://localhost:${PORT}`);
      console.log(`Socket.IO is ready`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
