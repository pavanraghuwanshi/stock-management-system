import type { Context } from "hono";
import mongoose from "mongoose";
import { Role } from "../models/role.model";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const validScopes = [
  "organization",
  "unit",
  "child_units",
  "team",
  "self",
  "custom",
];

export const createRole = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    const { name, permissions = [], scope = "self", canCreateRoles = [] } = body;

    if (!name) {
      return c.json({ success: false, message: "Role name is required" }, 400);
    }

    if (!validScopes.includes(scope)) {
      return c.json({ success: false, message: "Invalid scope" }, 400);
    }

    if (!Array.isArray(permissions)) {
      return c.json({ success: false, message: "permissions must be array" }, 400);
    }

    if (!Array.isArray(canCreateRoles)) {
      return c.json({ success: false, message: "canCreateRoles must be array" }, 400);
    }

    for (const id of canCreateRoles) {
      if (!isValidObjectId(id)) {
        return c.json({ success: false, message: "Invalid canCreateRoles id" }, 400);
      }
    }

    const exists = await Role.findOne({
      organizationId: user.organizationId,
      name: name.trim(),
    });

    if (exists) {
      return c.json({ success: false, message: "Role already exists" }, 409);
    }

    const validRoleCount = await Role.countDocuments({
      _id: { $in: canCreateRoles },
      organizationId: user.organizationId,
      isActive: true,
    });

    if (validRoleCount !== canCreateRoles.length) {
      return c.json(
        { success: false, message: "One or more canCreateRoles are invalid" },
        400
      );
    }

    const role = await Role.create({
      organizationId: user.organizationId,
      name: name.trim(),
      permissions,
      scope,
      canCreateRoles,
      isSystemRole: false,
      isActive: true,
    });

    return c.json(
      {
        success: true,
        message: "Role created successfully",
        data: role,
      },
      201
    );
  } catch (error: any) {
    if (error.code === 11000) {
      return c.json({ success: false, message: "Role already exists" }, 409);
    }

    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getAllRoles = async (c: Context) => {
  try {
    const user = c.get("user");

    const roles = await Role.find({
      organizationId: user.organizationId,
    }).sort({ createdAt: -1 });

    return c.json({
      success: true,
      count: roles.length,
      data: roles,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getRoleById = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid role id" }, 400);
    }

    const role = await Role.findOne({
      _id: id,
      organizationId: user.organizationId,
    });

    if (!role) {
      return c.json({ success: false, message: "Role not found" }, 404);
    }

    return c.json({
      success: true,
      data: role,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateRole = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid role id" }, 400);
    }

    const role = await Role.findOne({
      _id: id,
      organizationId: user.organizationId,
    });

    if (!role) {
      return c.json({ success: false, message: "Role not found" }, 404);
    }

    if (role.isSystemRole && body.isActive === false) {
      return c.json(
        { success: false, message: "System role cannot be disabled" },
        400
      );
    }

    if (body.name !== undefined) {
      if (!body.name) {
        return c.json({ success: false, message: "Role name cannot be empty" }, 400);
      }

      const exists = await Role.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        name: body.name.trim(),
      });

      if (exists) {
        return c.json({ success: false, message: "Role already exists" }, 409);
      }

      role.name = body.name.trim();
    }

    if (body.scope !== undefined) {
      if (!validScopes.includes(body.scope)) {
        return c.json({ success: false, message: "Invalid scope" }, 400);
      }

      role.scope = body.scope;
    }

    if (body.permissions !== undefined) {
      if (!Array.isArray(body.permissions)) {
        return c.json({ success: false, message: "permissions must be array" }, 400);
      }

      role.permissions = body.permissions;
    }

    if (body.canCreateRoles !== undefined) {
      if (!Array.isArray(body.canCreateRoles)) {
        return c.json({ success: false, message: "canCreateRoles must be array" }, 400);
      }

      for (const roleId of body.canCreateRoles) {
        if (!isValidObjectId(roleId)) {
          return c.json({ success: false, message: "Invalid canCreateRoles id" }, 400);
        }
      }

      const validRoleCount = await Role.countDocuments({
        _id: { $in: body.canCreateRoles },
        organizationId: user.organizationId,
        isActive: true,
      });

      if (validRoleCount !== body.canCreateRoles.length) {
        return c.json(
          { success: false, message: "One or more canCreateRoles are invalid" },
          400
        );
      }

      role.canCreateRoles = body.canCreateRoles;
    }

    if (body.isActive !== undefined) {
      role.isActive = body.isActive;
    }

    await role.save();

    return c.json({
      success: true,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return c.json({ success: false, message: "Role already exists" }, 409);
    }

    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteRole = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid role id" }, 400);
    }

    const role = await Role.findOne({
      _id: id,
      organizationId: user.organizationId,
    });

    if (!role) {
      return c.json({ success: false, message: "Role not found" }, 404);
    }

    if (role.isSystemRole) {
      return c.json(
        { success: false, message: "System role cannot be deleted" },
        400
      );
    }

    role.isActive = false;
    await role.save();

    return c.json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};