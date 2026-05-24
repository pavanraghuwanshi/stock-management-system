import { Hono } from "hono";
import {
    createUnit,
    getUnits,
    getUnitById,
    updateUnit,
    deleteUnit,
} from "./unit.controller";
import { auth } from "../../middleware/auth.middleware";

const unitRoutes = new Hono();
unitRoutes.use("*", auth);

unitRoutes.post("/", createUnit);
unitRoutes.get("/", getUnits);
unitRoutes.get("/:id", getUnitById);
unitRoutes.put("/:id", updateUnit);
unitRoutes.delete("/:id", deleteUnit);

export default unitRoutes;
