import type { Context } from "hono";
import mongoose from "mongoose";
import { Floor } from "./floor.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isMongoId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

export const createFloor = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.floorName || !body.floorNumber || !body.towerId) {
      return c.json(
        {
          success: false,
          message: "floorName, floorNumber and towerId are required",
        },
        400
      );
    }

    if (!isMongoId(body.towerId)) {
      return c.json({ success: false, message: "Invalid towerId" }, 400);
    }

    const exists = await Floor.findOne({
      organizationId: user.organizationId,
      towerId: body.towerId,
      floorNumber: body.floorNumber,
    });

    if (exists) {
      return c.json(
        {
          success: false,
          message: "Floor number already exists in this tower",
        },
        409
      );
    }

    const floor = await Floor.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id,
      createdBy: user._id,
    });

    const populatedFloor = await Floor.findById(floor._id).populate(
      "towerId",
      "towerName towerNumber"
    );

    return c.json(
      {
        success: true,
        message: "Floor created successfully",
        data: populatedFloor,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getFloors = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const status = c.req.query("status");
    const towerId = c.req.query("towerId");

    const skip = (page - 1) * limit;

    const query: any = {
      ...scopeFilter,
    };

    if (search) {
      query.$or = [
        { floorName: { $regex: search, $options: "i" } },
        { floorNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (towerId) {
      if (!isMongoId(towerId)) {
        return c.json({ success: false, message: "Invalid towerId" }, 400);
      }

      query.towerId = towerId;
    }

    const total = await Floor.countDocuments(query);

    const floors = await Floor.find(query)
      .populate("towerId", "towerName towerNumber")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      data: floors,
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

export const getFloorById = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Floor id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid floor id" }, 400);
    }

    const floor = await Floor.findOne({
      _id: id,
      ...scopeFilter,
    }).populate("towerId", "towerName towerNumber");

    if (!floor) {
      return c.json({ success: false, message: "Floor not found" }, 404);
    }

    return c.json({
      success: true,
      data: floor,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateFloor = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "Floor id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid floor id" }, 400);
    }

    if (body.towerId && !isMongoId(body.towerId)) {
      return c.json({ success: false, message: "Invalid towerId" }, 400);
    }

    if (body.floorNumber || body.towerId) {
      const currentFloor = await Floor.findOne({
        _id: id,
        ...scopeFilter,
      });

      if (!currentFloor) {
        return c.json({ success: false, message: "Floor not found" }, 404);
      }

      const exists = await Floor.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        towerId: body.towerId || currentFloor.towerId,
        floorNumber: body.floorNumber || currentFloor.floorNumber,
      });

      if (exists) {
        return c.json(
          {
            success: false,
            message: "Floor number already exists in this tower",
          },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;

    const floor = await Floor.findOneAndUpdate(
      {
        _id: id,
        ...scopeFilter,
      },
      body,
      {
        new: true,
        runValidators: true,
      }
    ).populate("towerId", "towerName towerNumber");

    if (!floor) {
      return c.json({ success: false, message: "Floor not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Floor updated successfully",
      data: floor,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteFloor = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Floor id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid floor id" }, 400);
    }

    const floor = await Floor.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!floor) {
      return c.json({ success: false, message: "Floor not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Floor deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};