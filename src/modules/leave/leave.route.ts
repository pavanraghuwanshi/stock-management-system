import { Hono } from "hono";
import {
  applyLeave,
  createLeaveForUser,
  getAllLeaves,
  getMyLeaves,
  getLeaveById,
  updateLeave,
  approveRejectLeave,
  cancelLeave,
  deleteLeave,
} from "./leave.controller";

import { auth } from "../../middleware/auth.middleware";

const leaveRoutes = new Hono();

leaveRoutes.use("*", auth);

leaveRoutes.post("/apply", applyLeave);
leaveRoutes.post("/", createLeaveForUser);

leaveRoutes.get("/", getAllLeaves);
leaveRoutes.get("/my", getMyLeaves);
leaveRoutes.get("/:id", getLeaveById);

leaveRoutes.patch("/:id", updateLeave);
leaveRoutes.patch("/:id/status", approveRejectLeave);
leaveRoutes.patch("/:id/cancel", cancelLeave);

leaveRoutes.delete("/:id", deleteLeave);

export default leaveRoutes;