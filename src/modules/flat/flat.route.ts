import { Hono } from "hono";
import {
    createFlat,
    getFlats,
    getFlatById,
    updateFlat,
    deleteFlat,
} from "./flat.controller";
import { auth } from "../../middleware/auth.middleware";

const flatRoutes = new Hono();
flatRoutes.use("*", auth);

flatRoutes.post("/", createFlat);
flatRoutes.get("/", getFlats);
flatRoutes.get("/:id", getFlatById);
flatRoutes.put("/:id", updateFlat);
flatRoutes.delete("/:id", deleteFlat);

export default flatRoutes;
