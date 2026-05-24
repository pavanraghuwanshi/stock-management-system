import { Hono } from "hono";
import {
    createSubGroup,
    getSubGroups,
    getSubGroupById,
    updateSubGroup,
    deleteSubGroup,
} from "./subGroup.controller";
import { auth } from "../../middleware/auth.middleware";

const subGroupRoutes = new Hono();

subGroupRoutes.use("*", auth);

subGroupRoutes.post("/", createSubGroup);
subGroupRoutes.get("/", getSubGroups);
subGroupRoutes.get("/:id", getSubGroupById);
subGroupRoutes.put("/:id", updateSubGroup);
subGroupRoutes.delete("/:id", deleteSubGroup);

export default subGroupRoutes;
