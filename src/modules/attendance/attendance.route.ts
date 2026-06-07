import { Hono } from "hono";

import {
  punchIn,
  punchOut,
  markAttendanceByAdmin,
  getAttendances,
  getMyTodayAttendance,
} from "./attendance.controller";

import { auth } from "../../middleware/auth.middleware";

const attendanceRoutes = new Hono();

attendanceRoutes.use("*", auth);

attendanceRoutes.post("/punch-in", punchIn);
attendanceRoutes.patch("/punch-out/:id", punchOut);

attendanceRoutes.get("/today/me", getMyTodayAttendance);

attendanceRoutes.post("/mark", markAttendanceByAdmin);

attendanceRoutes.get("/", getAttendances);

export default attendanceRoutes;