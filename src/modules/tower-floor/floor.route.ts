import { Hono } from "hono";
import {
    createFloor,
    getFloors,
    getFloorById,
    updateFloor,
    deleteFloor,
} from "./floor.controller";
import { auth } from "../../middleware/auth.middleware";

const floorRoutes = new Hono();

floorRoutes.use("*", auth);

floorRoutes.post("/", createFloor);
floorRoutes.get("/", getFloors);
floorRoutes.get("/:id", getFloorById);
floorRoutes.put("/:id", updateFloor);
floorRoutes.delete("/:id", deleteFloor);

export default floorRoutes;
