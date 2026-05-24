import type { Context } from "hono";
import mongoose from "mongoose";
import { Group } from "./group.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isMongoId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

export const createGroup = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.name) {
      return c.json({ success: false, message: "name is required" }, 400);
    }

    const exists = await Group.findOne({
      organizationId: user.organizationId,
      name: body.name,
    });

    if (exists) {
      return c.json(
        { success: false, message: "Group already exists" },
        409
      );
    }

    const group = await Group.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id,
      createdBy: user._id,
    });

    return c.json(
      {
        success: true,
        message: "Group created successfully",
        data: group,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getGroups = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const status = c.req.query("status");

    const skip = (page - 1) * limit;

    const query: any = {
      ...scopeFilter,
    };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (status) {
      query.status = status;
    }

    const total = await Group.countDocuments(query);

    const groups = await Group.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      data: groups,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getGroupById = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Group id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid group id" }, 400);
    }

    const group = await Group.findOne({
      _id: id,
      ...scopeFilter,
    });

    if (!group) {
      return c.json({ success: false, message: "Group not found" }, 404);
    }

    return c.json({
      success: true,
      data: group,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateGroup = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "Group id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid group id" }, 400);
    }

    if (body.name) {
      const exists = await Group.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        name: body.name,
      });

      if (exists) {
        return c.json(
          { success: false, message: "Group already exists" },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;

    const group = await Group.findOneAndUpdate(
      {
        _id: id,
        ...scopeFilter,
      },
      body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!group) {
      return c.json({ success: false, message: "Group not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Group updated successfully",
      data: group,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteGroup = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Group id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid group id" }, 400);
    }

    const group = await Group.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!group) {
      return c.json({ success: false, message: "Group not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};