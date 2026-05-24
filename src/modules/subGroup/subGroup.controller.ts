import type { Context } from "hono";
import mongoose from "mongoose";
import { SubGroup } from "./subGroup.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isMongoId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

export const createSubGroup = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.groupId || !body.name) {
      return c.json(
        { success: false, message: "groupId and name are required" },
        400
      );
    }

    if (!isMongoId(body.groupId)) {
      return c.json({ success: false, message: "Invalid groupId" }, 400);
    }

    const exists = await SubGroup.findOne({
      organizationId: user.organizationId,
      groupId: body.groupId,
      name: body.name,
    });

    if (exists) {
      return c.json(
        { success: false, message: "SubGroup already exists in this group" },
        409
      );
    }

    const subGroup = await SubGroup.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id,
      createdBy: user._id,
    });

    const populatedSubGroup = await SubGroup.findById(subGroup._id).populate(
      "groupId",
      "name"
    );

    return c.json(
      {
        success: true,
        message: "SubGroup created successfully",
        data: populatedSubGroup,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getSubGroups = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const status = c.req.query("status");
    const groupId = c.req.query("groupId");

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

    if (groupId) {
      if (!isMongoId(groupId)) {
        return c.json({ success: false, message: "Invalid groupId" }, 400);
      }

      query.groupId = groupId;
    }

    const total = await SubGroup.countDocuments(query);

    const subGroups = await SubGroup.find(query)
      .populate("groupId", "name")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      data: subGroups,
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

export const getSubGroupById = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "SubGroup id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid SubGroup id" }, 400);
    }

    const subGroup = await SubGroup.findOne({
      _id: id,
      ...scopeFilter,
    }).populate("groupId", "name");

    if (!subGroup) {
      return c.json({ success: false, message: "SubGroup not found" }, 404);
    }

    return c.json({
      success: true,
      data: subGroup,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateSubGroup = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "SubGroup id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid SubGroup id" }, 400);
    }

    if (body.groupId && !isMongoId(body.groupId)) {
      return c.json({ success: false, message: "Invalid groupId" }, 400);
    }

    if (body.name || body.groupId) {
      const currentSubGroup = await SubGroup.findOne({
        _id: id,
        ...scopeFilter,
      });

      if (!currentSubGroup) {
        return c.json({ success: false, message: "SubGroup not found" }, 404);
      }

      const exists = await SubGroup.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        groupId: body.groupId || currentSubGroup.groupId,
        name: body.name || currentSubGroup.name,
      });

      if (exists) {
        return c.json(
          { success: false, message: "SubGroup already exists in this group" },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;

    const subGroup = await SubGroup.findOneAndUpdate(
      {
        _id: id,
        ...scopeFilter,
      },
      body,
      {
        new: true,
        runValidators: true,
      }
    ).populate("groupId", "name");

    if (!subGroup) {
      return c.json({ success: false, message: "SubGroup not found" }, 404);
    }

    return c.json({
      success: true,
      message: "SubGroup updated successfully",
      data: subGroup,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteSubGroup = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "SubGroup id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid SubGroup id" }, 400);
    }

    const subGroup = await SubGroup.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!subGroup) {
      return c.json({ success: false, message: "SubGroup not found" }, 404);
    }

    return c.json({
      success: true,
      message: "SubGroup deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};