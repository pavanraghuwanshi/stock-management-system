import { Hono } from "hono";
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
} from "./vendor.controller";

import { auth } from "../../middleware/auth.middleware";

const vendorRoutes = new Hono();

vendorRoutes.use("*", auth);

vendorRoutes.post("/", createVendor);
vendorRoutes.get("/", getVendors);
vendorRoutes.get("/:id", getVendorById);
vendorRoutes.put("/:id", updateVendor);
vendorRoutes.delete("/:id", deleteVendor);

export default vendorRoutes;