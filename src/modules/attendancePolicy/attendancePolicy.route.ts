import { Hono } from "hono";
import {
  createAttendancePolicy,
  getAttendancePolicies,
  getAttendancePolicyById,
  updateAttendancePolicy,
  deleteAttendancePolicy,
} from "./attendancePolicy.controller";

import { auth } from "../../middleware/auth.middleware";

const attendancePolicyRoutes = new Hono();

attendancePolicyRoutes.use("*", auth);

attendancePolicyRoutes.post("/", createAttendancePolicy);
attendancePolicyRoutes.get("/", getAttendancePolicies);
attendancePolicyRoutes.get("/:id", getAttendancePolicyById);
attendancePolicyRoutes.patch("/:id", updateAttendancePolicy);
attendancePolicyRoutes.delete("/:id", deleteAttendancePolicy);

export default attendancePolicyRoutes;