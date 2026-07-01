import { Hono } from "hono";
import { auth } from "../../middleware/auth.middleware";
import {
  createGatePass,
  verifyGatePassAtLocation,
  approveGatePass,
  rejectGatePass,
  getAllGatePasses,
} from "./gatePass.controller";

const gatePassRoutes = new Hono();

gatePassRoutes.use("*", auth);

gatePassRoutes.post("/", createGatePass);
gatePassRoutes.get("/", getAllGatePasses);
gatePassRoutes.patch("/verify/:id", verifyGatePassAtLocation);
gatePassRoutes.patch("/approve/:id", approveGatePass);
gatePassRoutes.patch("/reject/:id", rejectGatePass);

export default gatePassRoutes;