// device.route.ts

import { Hono } from "hono";
import { auth } from "../../middleware/auth.middleware";

import {
  saveUserDevice,
  getAllUserDevices,
  getUserDeviceByUserId,
  updateUserDevice,
  resetUserDevice,
} from "./loginDevice.controller";

const deviceRoutes = new Hono();

deviceRoutes.use("*", auth);

deviceRoutes.post("/save", saveUserDevice);

deviceRoutes.get("/", getAllUserDevices);
deviceRoutes.get("/:userId", getUserDeviceByUserId);

deviceRoutes.patch("/:userId", updateUserDevice);
deviceRoutes.delete("/:userId/reset", resetUserDevice);

export default deviceRoutes;