import type { Context } from "hono";
import mongoose from "mongoose";
import { User } from "./user.model";
import { Role } from "../roles/role.model";
import { BusinessNode } from "../businessNode/businessNode.model";
import { encryptPassword, decryptPassword } from "../../utils/crypto";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const cleanUser = (user: any, showPassword = false) => {
  const obj = user.toObject ? user.toObject() : user;

  if (showPassword && obj.password?.iv && obj.password?.content) {
    obj.plainPassword = decryptPassword(obj.password);
  }

  delete obj.password;
  return obj;
};

export const createUser = async (c: Context) => {
  try {
    const creator = c.get("user");
    const body = await c.req.json();

    const {
      name,
      email,
      mobile,
      password,
      roleId,
      nodeIds = [],
      primaryNodeId,
      reportsTo,
    } = body;

    if (!name || !email || !password || !roleId) {
      return c.json(
        {
          success: false,
          message: "name, email, password and roleId are required",
        },
        400
      );
    }

    if (!isValidObjectId(roleId)) {
      return c.json({ success: false, message: "Invalid roleId" }, 400);
    }

    if (primaryNodeId && !isValidObjectId(primaryNodeId)) {
      return c.json({ success: false, message: "Invalid primaryNodeId" }, 400);
    }

    if (reportsTo && !isValidObjectId(reportsTo)) {
      return c.json({ success: false, message: "Invalid reportsTo" }, 400);
    }

    if (!Array.isArray(nodeIds)) {
      return c.json({ success: false, message: "nodeIds must be array" }, 400);
    }

    for (const id of nodeIds) {
      if (!isValidObjectId(id)) {
        return c.json({ success: false, message: "Invalid nodeIds" }, 400);
      }
    }

    const existingUser = await User.findOne({
      organizationId: creator.organizationId,
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return c.json({ success: false, message: "Email already exists" }, 409);
    }

    const role = await Role.findOne({
      _id: roleId,
      organizationId: creator.organizationId,
      isActive: true,
    });

    if (!role) {
      return c.json({ success: false, message: "Role not found" }, 404);
    }

    if (nodeIds.length > 0) {
      const unitsCount = await BusinessNode.countDocuments({
        _id: { $in: nodeIds },
        organizationId: creator.organizationId,
        isActive: true,
      });

      if (unitsCount !== nodeIds.length) {
        return c.json(
          { success: false, message: "One or more units are invalid" },
          400
        );
      }
    }

    if (primaryNodeId && !nodeIds.includes(primaryNodeId)) {
      return c.json(
        {
          success: false,
          message: "primaryNodeId must exist inside nodeIds",
        },
        400
      );
    }

    let parentUser: any = null;

    if (reportsTo) {
      parentUser = await User.findOne({
        _id: reportsTo,
        organizationId: creator.organizationId,
        isActive: true,
      });

      if (!parentUser) {
        return c.json({ success: false, message: "Reporting user not found" }, 404);
      }
    }

    const encryptedPassword = encryptPassword(password);

    const ancestorUserIds = parentUser
      ? [...parentUser.ancestorUserIds, parentUser._id]
      : [];

    const user = await User.create({
      organizationId: creator.organizationId,
      name,
      email: email.toLowerCase(),
      mobile: mobile || null,
      password: encryptedPassword,
      roleId,
      nodeIds,
      primaryNodeId: primaryNodeId || null,
      reportsTo: reportsTo || null,
      ancestorUserIds,
    });

    const populatedUser = await User.findById(user._id)
      .populate("roleId", "name scope permissions")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type")
      .populate("reportsTo", "name email");

    return c.json(
      {
        success: true,
        message: "User created successfully",
        data: cleanUser(populatedUser),
      },
      201
    );
  } catch (error: any) {
    if (error.code === 11000) {
      return c.json({ success: false, message: "Email already exists" }, 409);
    }

    return c.json(
      {
        success: false,
        message: error.message || "Something went wrong",
      },
      400
    );
  }
};

export const getAllUsers = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const users = await User.find({
      organizationId: loggedInUser.organizationId,
    })
      .populate("roleId", "name scope permissions")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type")
      .populate("reportsTo", "name email")
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      count: users.length,
      data: users.map((u) => cleanUser(u)),
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getUserById = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");
    const showPassword = c.req.query("showPassword") === "true";

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid user id" }, 400);
    }

    const user = await User.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
    })
      .select("+password")
      .populate("roleId", "name scope permissions")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type")
      .populate("reportsTo", "name email");

    if (!user) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    return c.json({
      success: true,
      data: cleanUser(user, showPassword),
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateUser = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid user id" }, 400);
    }

    const user = await User.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
    });

    if (!user) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    if (body.email) {
      const emailExists = await User.findOne({
        _id: { $ne: id },
        organizationId: loggedInUser.organizationId,
        email: body.email.toLowerCase(),
      });

      if (emailExists) {
        return c.json({ success: false, message: "Email already exists" }, 409);
      }

      user.email = body.email.toLowerCase();
    }

    if (body.roleId) {
      if (!isValidObjectId(body.roleId)) {
        return c.json({ success: false, message: "Invalid roleId" }, 400);
      }

      const role = await Role.findOne({
        _id: body.roleId,
        organizationId: loggedInUser.organizationId,
        isActive: true,
      });

      if (!role) {
        return c.json({ success: false, message: "Role not found" }, 404);
      }

      user.roleId = body.roleId;
    }

    if (body.nodeIds) {
      if (!Array.isArray(body.nodeIds)) {
        return c.json({ success: false, message: "nodeIds must be array" }, 400);
      }

      const unitsCount = await BusinessNode.countDocuments({
        _id: { $in: body.nodeIds },
        organizationId: loggedInUser.organizationId,
        isActive: true,
      });

      if (unitsCount !== body.nodeIds.length) {
        return c.json(
          { success: false, message: "One or more units are invalid" },
          400
        );
      }

      user.nodeIds = body.nodeIds;
    }

    if (body.primaryNodeId !== undefined) {
      if (body.primaryNodeId && !isValidObjectId(body.primaryNodeId)) {
        return c.json({ success: false, message: "Invalid primaryNodeId" }, 400);
      }

      if (body.primaryNodeId && !user.nodeIds.map(String).includes(body.primaryNodeId)) {
        return c.json(
          { success: false, message: "primaryNodeId must exist inside nodeIds" },
          400
        );
      }

      user.primaryNodeId = body.primaryNodeId || null;
    }

    if (body.reportsTo !== undefined) {
      if (body.reportsTo && !isValidObjectId(body.reportsTo)) {
        return c.json({ success: false, message: "Invalid reportsTo" }, 400);
      }

      if (body.reportsTo && body.reportsTo === id) {
        return c.json(
          { success: false, message: "User cannot report to himself" },
          400
        );
      }

      let parentUser: any = null;

      if (body.reportsTo) {
        parentUser = await User.findOne({
          _id: body.reportsTo,
          organizationId: loggedInUser.organizationId,
          isActive: true,
        });

        if (!parentUser) {
          return c.json({ success: false, message: "Reporting user not found" }, 404);
        }

        if (parentUser.ancestorUserIds.map(String).includes(id)) {
          return c.json(
            { success: false, message: "Invalid hierarchy cycle detected" },
            400
          );
        }
      }

      user.reportsTo = body.reportsTo || null;
      user.ancestorUserIds = parentUser
        ? [...parentUser.ancestorUserIds, parentUser._id]
        : [];
    }

    if (body.password) {
      user.password = encryptPassword(body.password) as any;
    }

    if (body.name !== undefined) user.name = body.name;
    if (body.mobile !== undefined) user.mobile = body.mobile || null;
    if (body.isActive !== undefined) user.isActive = body.isActive;

    await user.save();

    const updatedUser = await User.findById(user._id)
      .populate("roleId", "name scope permissions")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type")
      .populate("reportsTo", "name email");

    return c.json({
      success: true,
      message: "User updated successfully",
      data: cleanUser(updatedUser),
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteUser = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid user id" }, 400);
    }

    if (String(loggedInUser._id) === id) {
      return c.json(
        { success: false, message: "You cannot delete yourself" },
        400
      );
    }

    const user = await User.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
    });

    if (!user) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    const childUsers = await User.countDocuments({
      organizationId: loggedInUser.organizationId,
      reportsTo: id,
      isActive: true,
    });

    if (childUsers > 0) {
      return c.json(
        {
          success: false,
          message: "This user has reporting users. Reassign them first.",
        },
        400
      );
    }

    user.isActive = false;
    await user.save();

    return c.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};