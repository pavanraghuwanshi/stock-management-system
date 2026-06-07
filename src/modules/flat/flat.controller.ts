import type { Context } from "hono";
import mongoose from "mongoose";
import { Flat } from "./flat.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isMongoId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

const populateFloor = {
  path: "floorId",
  select: "floorName floorNumber towerId",
  populate: {
    path: "towerId",
    select: "towerName towerNumber",
  },
};

export const createFlat = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.flatName || !body.flatNumber || !body.floorId) {
      return c.json(
        {
          success: false,
          message: "flatName, flatNumber and floorId are required",
        },
        400
      );
    }

    if (!isMongoId(body.floorId)) {
      return c.json({ success: false, message: "Invalid floorId" }, 400);
    }

    const exists = await Flat.findOne({
      organizationId: user.organizationId,
      floorId: body.floorId,
      flatNumber: body.flatNumber,
    });

    if (exists) {
      return c.json(
        {
          success: false,
          message: "Flat number already exists on this floor",
        },
        409
      );
    }

    const flat = await Flat.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id,
      createdBy: user._id,
    });

    const populatedFlat = await Flat.findById(flat._id).populate(
      populateFloor
    );

    return c.json(
      {
        success: true,
        message: "Flat created successfully",
        data: populatedFlat,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getFlats = async (c: Context) => {
  try {
    const user = c.get("user");

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const status = c.req.query("status");
    const floorId = c.req.query("floorId");

    const skip = (page - 1) * limit;

    if (!user?.organizationId) {
      return c.json(
        { success: false, message: "organizationId not found in token" },
        400
      );
    }

    const query: any = {
      organizationId: user.organizationId,
    };

    if (search) {
      query.$or = [
        { flatName: { $regex: search, $options: "i" } },
        { flatNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (floorId) {
      if (!isMongoId(floorId)) {
        return c.json({ success: false, message: "Invalid floorId" }, 400);
      }

      query.floorId = floorId;
    }

    const total = await Flat.countDocuments(query);

    const allFlats = await Flat.find(query)
      .populate(populateFloor)
      .lean();

    allFlats.sort((a: any, b: any) => {
      return Number(a.flatNumber) - Number(b.flatNumber);
    });

    const flats = allFlats.slice(skip, skip + limit);

    return c.json({
      success: true,
      data: flats,
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

export const getFlatById = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Flat id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid flat id" }, 400);
    }

    if (!user?.organizationId) {
      return c.json(
        { success: false, message: "organizationId not found in token" },
        400
      );
    }

    const flat = await Flat.findOne({
      _id: id,
      organizationId: user.organizationId,
    }).populate(populateFloor);

    if (!flat) {
      return c.json({ success: false, message: "Flat not found" }, 404);
    }

    return c.json({
      success: true,
      data: flat,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateFlat = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "Flat id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid flat id" }, 400);
    }

    if (body.floorId && !isMongoId(body.floorId)) {
      return c.json({ success: false, message: "Invalid floorId" }, 400);
    }

    if (body.flatNumber || body.floorId) {
      const currentFlat = await Flat.findOne({
        _id: id,
        ...scopeFilter,
      });

      if (!currentFlat) {
        return c.json({ success: false, message: "Flat not found" }, 404);
      }

      const exists = await Flat.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        floorId: body.floorId || currentFlat.floorId,
        flatNumber: body.flatNumber || currentFlat.flatNumber,
      });

      if (exists) {
        return c.json(
          {
            success: false,
            message: "Flat number already exists on this floor",
          },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;

    const flat = await Flat.findOneAndUpdate(
      {
        _id: id,
        ...scopeFilter,
      },
      body,
      {
        new: true,
        runValidators: true,
      }
    ).populate(populateFloor);

    if (!flat) {
      return c.json({ success: false, message: "Flat not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Flat updated successfully",
      data: flat,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteFlat = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Flat id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid flat id" }, 400);
    }

    const flat = await Flat.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!flat) {
      return c.json({ success: false, message: "Flat not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Flat deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};