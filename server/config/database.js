import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing");
  }

  await mongoose.connect(uri);

  console.log("MongoDB connected:", mongoose.connection.name);
}

export function getDatabaseStatus() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}
