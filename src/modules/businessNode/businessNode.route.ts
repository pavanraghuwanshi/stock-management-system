import { Hono } from "hono";
import { auth } from "../../middleware/auth.middleware";
import { checkPermission } from "../../middleware/permission.middleware";

import { createBusinessNode, getAllBusinessNodes, getBusinessNodeById, updateBusinessNode, deleteBusinessNode,} from "./businessNode.controller";

export const businessNodeRoutes = new Hono();

businessNodeRoutes.post( "/", auth, checkPermission("businessNode:create"), createBusinessNode);

businessNodeRoutes.get("/",auth,checkPermission("businessNode:view"),getAllBusinessNodes);

businessNodeRoutes.get( "/:id", auth, checkPermission("businessNode:view"), getBusinessNodeById);

businessNodeRoutes.patch( "/:id", auth, checkPermission("businessNode:update"), updateBusinessNode);

businessNodeRoutes.delete("/:id",auth,checkPermission("businessNode:delete"),deleteBusinessNode);