import { Hono } from "hono";
import {
    createGroup,
    getGroups,
    getGroupById,
    updateGroup,
    deleteGroup,
} from "./group.controller";
import { auth } from "../../middleware/auth.middleware";

const groupRoutes = new Hono();
groupRoutes.use("*", auth);

groupRoutes.post("/", createGroup);
groupRoutes.get("/", getGroups);
groupRoutes.get("/:id", getGroupById);
groupRoutes.put("/:id", updateGroup);
groupRoutes.delete("/:id", deleteGroup);

export default groupRoutes;
