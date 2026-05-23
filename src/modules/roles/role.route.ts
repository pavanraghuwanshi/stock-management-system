import { Hono } from "hono";

import { auth } from "../middleware/auth";
import { checkPermission } from "../middleware/permission";

import {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
} from "../controllers/role.controller";

export const roleRoutes = new Hono();


// ----------------------------------------------------
// CREATE ROLE
// ----------------------------------------------------

roleRoutes.post(
  "/",
  auth,
  checkPermission("role:create"),
  createRole
);


// ----------------------------------------------------
// GET ALL ROLES
// ----------------------------------------------------

roleRoutes.get(
  "/",
  auth,
  checkPermission("role:view"),
  getAllRoles
);


// ----------------------------------------------------
// GET SINGLE ROLE
// ----------------------------------------------------

roleRoutes.get(
  "/:id",
  auth,
  checkPermission("role:view"),
  getRoleById
);


// ----------------------------------------------------
// UPDATE ROLE
// ----------------------------------------------------

roleRoutes.patch(
  "/:id",
  auth,
  checkPermission("role:update"),
  updateRole
);


// ----------------------------------------------------
// DELETE ROLE
// ----------------------------------------------------

roleRoutes.delete(
  "/:id",
  auth,
  checkPermission("role:delete"),
  deleteRole
);