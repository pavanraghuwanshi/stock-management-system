import type { Context } from "hono";
import mongoose from "mongoose";
import { Tower } from "./tower.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isMongoId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

export const createTower = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.towerName || !body.towerNumber || !body.projectId) {
      return c.json(
        {
          success: false,
          message: "towerName, towerNumber and projectId are required",
        },
        400
      );
    }

    if (!isMongoId(body.projectId)) {
      return c.json({ success: false, message: "Invalid projectId" }, 400);
    }

    const exists = await Tower.findOne({
      organizationId: user.organizationId,
      projectId: body.projectId,
      towerNumber: body.towerNumber,
    });

    if (exists) {
      return c.json(
        {
          success: false,
          message: "Tower number already exists in this project",
        },
        409
      );
    }

    const tower = await Tower.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id,
      createdBy: user._id,
    });

    const populatedTower = await Tower.findById(tower._id).populate(
      "projectId",
      "projectName"
    );

    return c.json(
      {
        success: true,
        message: "Tower created successfully",
        data: populatedTower,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getTowers = async (c: Context) => {
  try {
    const user = c.get("user");

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const status = c.req.query("status");
    const projectId = c.req.query("projectId");

    const skip = (page - 1) * limit;

    const query: any = {
      organizationId: user.organizationId,
    };

    if (search) {
      query.$or = [
        { towerName: { $regex: search, $options: "i" } },
        { towerNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (projectId) {
      if (!isMongoId(projectId)) {
        return c.json({ success: false, message: "Invalid projectId" }, 400);
      }

      query.projectId = projectId;
    }

    const total = await Tower.countDocuments(query);

    const towers = await Tower.find(query)
      .populate("projectId", "projectName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return c.json({
      success: true,
      data: towers,
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

export const getTowerById = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Tower id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid tower id" }, 400);
    }

    const tower = await Tower.findOne({
      _id: id,
      organizationId: user.organizationId,
    }).populate("projectId", "projectName");

    if (!tower) {
      return c.json({ success: false, message: "Tower not found" }, 404);
    }

    return c.json({
      success: true,
      data: tower,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const updateTower = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "Tower id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid tower id" }, 400);
    }

    if (body.projectId && !isMongoId(body.projectId)) {
      return c.json({ success: false, message: "Invalid projectId" }, 400);
    }

    if (body.towerNumber || body.projectId) {
      const currentTower = await Tower.findOne({
        _id: id,
        ...scopeFilter,
      });

      if (!currentTower) {
        return c.json({ success: false, message: "Tower not found" }, 404);
      }

      const exists = await Tower.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        projectId: body.projectId || currentTower.projectId,
        towerNumber: body.towerNumber || currentTower.towerNumber,
      });

      if (exists) {
        return c.json(
          {
            success: false,
            message: "Tower number already exists in this project",
          },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;

    const tower = await Tower.findOneAndUpdate(
      {
        _id: id,
        ...scopeFilter,
      },
      body,
      {
        new: true,
        runValidators: true,
      }
    ).populate("projectId", "projectName");

    if (!tower) {
      return c.json({ success: false, message: "Tower not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Tower updated successfully",
      data: tower,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteTower = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Tower id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid tower id" }, 400);
    }

    const tower = await Tower.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!tower) {
      return c.json({ success: false, message: "Tower not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Tower deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};