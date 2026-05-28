// advance.route.ts

import { Hono } from "hono";
import {
  createAdvance,
  getAllAdvances,
  getMyAdvances,
  getAdvanceById,
  updateAdvance,
  settleAdvance,
  cancelAdvance,
  deleteAdvance,
} from "./advance.controller";

import { auth } from "../../middleware/auth.middleware";

const advanceRoutes = new Hono();

advanceRoutes.use("*", auth);

advanceRoutes.post("/", createAdvance);

advanceRoutes.get("/", getAllAdvances);
advanceRoutes.get("/my", getMyAdvances);
advanceRoutes.get("/:id", getAdvanceById);

advanceRoutes.patch("/:id", updateAdvance);
advanceRoutes.patch("/:id/settle", settleAdvance);
advanceRoutes.patch("/:id/cancel", cancelAdvance);

advanceRoutes.delete("/:id", deleteAdvance);

export default advanceRoutes;