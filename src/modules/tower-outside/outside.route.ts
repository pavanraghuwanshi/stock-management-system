import { Hono } from "hono";
import {
    createOutside,
    getOutsides,
    getOutsideById,
    updateOutside,
    deleteOutside,
} from "./outside.controller";
import { auth } from "../../middleware/auth.middleware";

const outsideRoutes = new Hono();

outsideRoutes.use("*", auth);

outsideRoutes.post("/", createOutside);
outsideRoutes.get("/", getOutsides);
outsideRoutes.get("/:id", getOutsideById);
outsideRoutes.put("/:id", updateOutside);
outsideRoutes.delete("/:id", deleteOutside);

export default outsideRoutes;
