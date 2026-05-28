import type { Context } from "hono";
import mongoose from "mongoose";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { User } from "./user.model";
import { Role } from "../roles/role.model";
import { BusinessNode } from "../businessNode/businessNode.model";
import { encryptPassword, decryptPassword } from "../../utils/crypto";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const cleanUser = (user: any, showPassword = false) => {
  const obj = user.toObject ? user.toObject() : user;

  if (showPassword && obj.password?.iv && obj.password?.content) {
    obj.plainPassword = decryptPassword(obj.password);
  }

  delete obj.password;
  return obj;
};

const getStringValue = (value: any) => {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : "";
  return value ? String(value) : "";
};

const getNodeIdsFromBody = (body: any) => {
  const rawNodeIds = body["nodeIds[]"] || body.nodeIds || [];

  if (Array.isArray(rawNodeIds)) {
    return rawNodeIds.map(String).filter(Boolean);
  }

  if (rawNodeIds) {
    return [String(rawNodeIds)];
  }

  return [];
};

const saveProfileImage = async (file: any) => {
  if (!(file instanceof File)) return null;

  const uploadDir = "uploads/profile-images";
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name);
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const filePath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return `/${filePath.replace(/\\/g, "/")}`;
};

export const createUser = async (c: Context) => {
  try {
    const creator = c.get("user");
    const body = await c.req.parseBody();

    const name = getStringValue(body.name);
    const email = getStringValue(body.email);
    const mobile = getStringValue(body.mobile);
    const password = getStringValue(body.password);
    const roleId = getStringValue(body.roleId);
    const primaryNodeId = getStringValue(body.primaryNodeId);
    const reportsTo = getStringValue(body.reportsTo);

    const geofenceId = getStringValue(body.geofenceId);
    const projectId = getStringValue(body.projectId);
    const attendancePolicyId = getStringValue(body.attendancePolicyId);

    // ✅ ONLY ADDED THIS
    const organizationId =
      creator.role === "superAdmin"
        ? getStringValue(body.organizationId)
        : creator.organizationId;

    const nodeIds = getNodeIdsFromBody(body);

    const uploadedProfileImage =
      (await saveProfileImage(body.profileImage)) ||
      getStringValue(body.profileImage) ||
      null;

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

    if (geofenceId && !isValidObjectId(geofenceId)) {
      return c.json({ success: false, message: "Invalid geofenceId" }, 400);
    }

    if (projectId && !isValidObjectId(projectId)) {
      return c.json({ success: false, message: "Invalid projectId" }, 400);
    }

    if (attendancePolicyId && !isValidObjectId(attendancePolicyId)) {
      return c.json(
        { success: false, message: "Invalid attendancePolicyId" },
        400
      );
    }

    for (const id of nodeIds) {
      if (!isValidObjectId(id)) {
        return c.json({ success: false, message: "Invalid nodeIds" }, 400);
      }
    }

    const existingUser = await User.findOne({
      organizationId,
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return c.json({ success: false, message: "Email already exists" }, 409);
    }

    const role = await Role.findOne({
      _id: roleId,
      organizationId,
      isActive: true,
    });

    if (!role) {
      return c.json({ success: false, message: "Role not found" }, 404);
    }

    if (nodeIds.length > 0) {
      const unitsCount = await BusinessNode.countDocuments({
        _id: { $in: nodeIds },
        organizationId,
        isActive: true,
      });

      if (unitsCount !== nodeIds.length) {
        return c.json(
          { success: false, message: "One or more units are invalid" },
          400
        );
      }
    }

    if (primaryNodeId && !nodeIds.map(String).includes(String(primaryNodeId))) {
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
        organizationId,
        isActive: true,
      });

      if (!parentUser) {
        return c.json(
          { success: false, message: "Reporting user not found" },
          404
        );
      }
    }

    const encryptedPassword = encryptPassword(password);

    const ancestorUserIds = parentUser
      ? [...parentUser.ancestorUserIds, parentUser._id]
      : [];

    const user = await User.create({
      organizationId,
      name,
      email: email.toLowerCase(),
      mobile: mobile || null,
      password: encryptedPassword,
      roleId,
      nodeIds,
      primaryNodeId: primaryNodeId || null,
      reportsTo: reportsTo || null,
      ancestorUserIds,

      geofenceId: geofenceId || null,
      projectId: projectId || null,
      profileImage: uploadedProfileImage,
      attendancePolicyId: attendancePolicyId || null,
    });

    const populatedUser = await User.findById(user._id)
      .populate("roleId", "name scope permissions")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type")
      .populate("reportsTo", "name email")
      .populate("geofenceId", "name")
      .populate("projectId", "name")
      .populate("attendancePolicyId", "name");

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

    const scopeFilter: any = await buildScopeFilter(loggedInUser);

    const userFilter: any = {
      organizationId: scopeFilter.organizationId,
    };

    if (scopeFilter.ownerId?.$in) {
      userFilter._id = { $in: scopeFilter.ownerId.$in };
    } else if (scopeFilter.ownerId) {
      userFilter._id = scopeFilter.ownerId;
    }

    if (scopeFilter.nodeId) {
      userFilter.$or = [
        { primaryNodeId: scopeFilter.nodeId },
        { nodeIds: scopeFilter.nodeId },
      ];
    }

    const users = await User.find(userFilter)
      .populate("roleId", "name scope permissions")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type")
      .populate("reportsTo", "name email")
      .populate("geofenceId", "name")
      .populate("projectId", "name")
      .populate("attendancePolicyId", "name")
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

    const scopeFilter: any = await buildScopeFilter(loggedInUser);

    const userFilter: any = {
      organizationId: scopeFilter.organizationId,
    };

    if (scopeFilter.ownerId?.$in) {
      userFilter._id = { $in: scopeFilter.ownerId.$in };
    } else if (scopeFilter.ownerId) {
      userFilter._id = scopeFilter.ownerId;
    }

    if (scopeFilter.nodeId) {
      userFilter.$or = [
        { primaryNodeId: scopeFilter.nodeId },
        { nodeIds: scopeFilter.nodeId },
      ];
    }

    const user = await User.findOne({
      ...userFilter,
      _id: id,
    })
      .select("+password")
      .populate("roleId", "name scope permissions")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type")
      .populate("reportsTo", "name email")
      .populate("geofenceId", "name")
      .populate("projectId", "name")
      .populate("attendancePolicyId", "name");

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
    const body = await c.req.parseBody();

    const organizationId =
    loggedInUser?.roleId?.name === "superAdmin"
        ? getStringValue(body.organizationId)
        : loggedInUser.organizationId;

        console.log(organizationId,  loggedInUser.roleId?.name, body.organizationId);

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid user id" }, 400);
    }

    const scopeFilter: any = await buildScopeFilter(loggedInUser);

    const userFilter: any = {
      organizationId,
    };

    if (scopeFilter.ownerId?.$in) {
      userFilter._id = { $in: scopeFilter.ownerId.$in };
    } else if (scopeFilter.ownerId) {
      userFilter._id = scopeFilter.ownerId;
    }

    if (scopeFilter.nodeId) {
      userFilter.$or = [
        { primaryNodeId: scopeFilter.nodeId },
        { nodeIds: scopeFilter.nodeId },
      ];
    }

    const user = await User.findOne({
      ...userFilter,
      _id: id,
    });

    if (!user) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    const email = getStringValue(body.email);
    const roleId = getStringValue(body.roleId);
    const primaryNodeId = getStringValue(body.primaryNodeId);
    const reportsTo = getStringValue(body.reportsTo);
    const geofenceId = getStringValue(body.geofenceId);
    const projectId = getStringValue(body.projectId);
    const attendancePolicyId = getStringValue(body.attendancePolicyId);

    if (email) {
      const emailExists = await User.findOne({
        _id: { $ne: id },
        organizationId,
        email: email.toLowerCase(),
      });

      if (emailExists) {
        return c.json({ success: false, message: "Email already exists" }, 409);
      }

      user.email = email.toLowerCase();
    }

    if (roleId) {
      if (!isValidObjectId(roleId)) {
        return c.json({ success: false, message: "Invalid roleId" }, 400);
      }

      const role = await Role.findOne({
        _id: roleId,
        organizationId,
        isActive: true,
      });

      if (!role) {
        return c.json({ success: false, message: "Role not found" }, 404);
      }

      user.roleId = roleId as any;
    }

    if (body["nodeIds[]"] !== undefined || body.nodeIds !== undefined) {
      const nodeIds = getNodeIdsFromBody(body);

      for (const nodeId of nodeIds) {
        if (!isValidObjectId(nodeId)) {
          return c.json({ success: false, message: "Invalid nodeIds" }, 400);
        }
      }

      const unitsCount = await BusinessNode.countDocuments({
        _id: { $in: nodeIds },
        organizationId,
        isActive: true,
      });

      if (unitsCount !== nodeIds.length) {
        return c.json(
          { success: false, message: "One or more units are invalid" },
          400
        );
      }

      user.nodeIds = nodeIds as any;
    }

    if (body.primaryNodeId !== undefined) {
      if (primaryNodeId && !isValidObjectId(primaryNodeId)) {
        return c.json({ success: false, message: "Invalid primaryNodeId" }, 400);
      }

      if (
        primaryNodeId &&
        !user.nodeIds.map(String).includes(String(primaryNodeId))
      ) {
        return c.json(
          { success: false, message: "primaryNodeId must exist inside nodeIds" },
          400
        );
      }

      user.primaryNodeId = (primaryNodeId || null) as any;
    }

    if (body.reportsTo !== undefined) {
      if (reportsTo && !isValidObjectId(reportsTo)) {
        return c.json({ success: false, message: "Invalid reportsTo" }, 400);
      }

      if (reportsTo && reportsTo === id) {
        return c.json(
          { success: false, message: "User cannot report to himself" },
          400
        );
      }

      let parentUser: any = null;

      if (reportsTo) {
        parentUser = await User.findOne({
          _id: reportsTo,
          organizationId,
          isActive: true,
        });

        if (!parentUser) {
          return c.json(
            { success: false, message: "Reporting user not found" },
            404
          );
        }

        if (parentUser.ancestorUserIds.map(String).includes(id)) {
          return c.json(
            { success: false, message: "Invalid hierarchy cycle detected" },
            400
          );
        }
      }

      user.reportsTo = (reportsTo || null) as any;
      user.ancestorUserIds = parentUser
        ? [...parentUser.ancestorUserIds, parentUser._id]
        : [];
    }

    if (body.geofenceId !== undefined) {
      if (geofenceId && !isValidObjectId(geofenceId)) {
        return c.json({ success: false, message: "Invalid geofenceId" }, 400);
      }

      user.geofenceId = (geofenceId || null) as any;
    }

    if (body.projectId !== undefined) {
      if (projectId && !isValidObjectId(projectId)) {
        return c.json({ success: false, message: "Invalid projectId" }, 400);
      }

      user.projectId = (projectId || null) as any;
    }

    if (body.attendancePolicyId !== undefined) {
      if (attendancePolicyId && !isValidObjectId(attendancePolicyId)) {
        return c.json(
          { success: false, message: "Invalid attendancePolicyId" },
          400
        );
      }

      user.attendancePolicyId = (attendancePolicyId || null) as any;
    }

    if (body.profileImage !== undefined) {
      user.profileImage =
        (await saveProfileImage(body.profileImage)) ||
        getStringValue(body.profileImage) ||
        null;
    }

    const password = getStringValue(body.password);
    const name = getStringValue(body.name);
    const mobile = getStringValue(body.mobile);

    if (password) {
      user.password = encryptPassword(password) as any;
    }

    if (body.name !== undefined) user.name = name;
    if (body.mobile !== undefined) user.mobile = mobile || null;
    if (body.isActive !== undefined) user.isActive = body.isActive === "true";

    await user.save();

    const updatedUser = await User.findById(user._id)
      .populate("roleId", "name scope permissions")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type")
      .populate("reportsTo", "name email")
      .populate("geofenceId", "name")
      .populate("projectId", "name")
      .populate("attendancePolicyId", "name");

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

    const scopeFilter: any = await buildScopeFilter(loggedInUser);

    const userFilter: any = {
      organizationId: scopeFilter.organizationId,
    };

    if (scopeFilter.ownerId?.$in) {
      userFilter._id = { $in: scopeFilter.ownerId.$in };
    } else if (scopeFilter.ownerId) {
      userFilter._id = scopeFilter.ownerId;
    }

    if (scopeFilter.nodeId) {
      userFilter.$or = [
        { primaryNodeId: scopeFilter.nodeId },
        { nodeIds: scopeFilter.nodeId },
      ];
    }

    const user = await User.findOne({
      ...userFilter,
      _id: id,
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