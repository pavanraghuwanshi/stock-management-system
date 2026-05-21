import { serve } from "bun";
import app from "./app";

import { connectDB } from "./config/db";
import "dotenv/config"; // 👈 important

// connect database
await connectDB();

serve({
  fetch: app.fetch, 
  port: 9090,
});

console.log("🚀 Server running on http://localhost:5000");