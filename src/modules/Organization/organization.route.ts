import { Hono } from "hono";
import { auth } from "../../middleware/auth.middleware";
import { checkPermission } from "../../middleware/permission.middleware";

import { createOrganization, getAllOrganizations,  getOrganizationById,  updateOrganization,deleteOrganization,} from "./organization.controller";

export const organizationRoutes = new Hono();

organizationRoutes.post("/organizations",auth,checkPermission("organization:create"),createOrganization);

organizationRoutes.get( "/organizations", auth, checkPermission("organization:view"), getAllOrganizations);

organizationRoutes.get("/organizations/:id",auth,checkPermission("organization:view"), getOrganizationById);

organizationRoutes.patch("/organizations/:id",auth,checkPermission("organization:update"),updateOrganization);

organizationRoutes.delete("/organizations/:id", auth, checkPermission("organization:delete"), deleteOrganization);