import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import routes from "./routes";
import { organizationRoutes } from "./modules/Organization/organization.route";
import { authRoutes } from "./modules/auth/auth.route";

const app = new Hono();


// const allowedOrigins = [
//   "*"
// ];

// app.use("*", cors({
//   origin: (origin) => {
//     if (!origin) return origin; // allow Postman / server calls
//     return allowedOrigins.includes(origin) ? origin : "";
//   },
//   cr edentials: true,
// }));

app.use("*", cors());

app.get("/", (c) => {
  return c.json({ message: "CRM API running 🚀" });
});

// 📁 serve static files from uploads folder
app.use(
  "/api/uploads/*",
  serveStatic({
    root: "./uploads",
    rewriteRequestPath: (path) => path.replace(/^\/api\/uploads/, ""),
  })
);

app.route("/api", routes);

app.route("/api", organizationRoutes);


app.route("/api", authRoutes);


export default app;