import type { Context } from "hono";
import mongoose from "mongoose";
import { Outside } from "./outside.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isMongoId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

export const createOutside = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.outsideName || !body.towerId) {
      return c.json(
        { success: false, message: "outsideName and towerId are required" },
        400
      );
    }

    if (!isMongoId(body.towerId)) {
      return c.json({ success: false, message: "Invalid towerId" }, 400);
    }

    const exists = await Outside.findOne({
      organizationId: user.organizationId,
      towerId: body.towerId,
      outsideName: body.outsideName,
    });

    if (exists) {
      return c.json(
        {
          success: false,
          message: "Outside record already exists in this tower",
        },
        409
      );
    }

    const outside = await Outside.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id,
      createdBy: user._id,
    });

    const populatedOutside = await Outside.findById(outside._id).populate(
      "towerId",
      "towerName towerNumber"
    );

    return c.json(
      {
        success: true,
        message: "Outside record created successfully",
        data: populatedOutside,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getOutsides = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const status = c.req.query("status");
    const towerId = c.req.query("towerId");

    const skip = (page - 1) * limit;

    const query: any = { ...scopeFilter };

    if (search) {
      query.$or = [
        { outsideName: { $regex: search, $options: "i" } },
        { outsideNote: { $regex: search, $options: "i" } },
      ];
    }

    if (status) query.status = status;

    if (towerId) {
      if (!isMongoId(towerId)) {
        return c.json({ success: false, message: "Invalid towerId" }, 400);
      }
      query.towerId = towerId;
    }

    const total = await Outside.countDocuments(query);

    const outsides = await Outside.find(query)
      .populate("towerId", "towerName towerNumber")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      data: outsides,
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

export const getOutsideById = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Outside id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid outside id" }, 400);
    }

    const outside = await Outside.findOne({
      _id: id,
      ...scopeFilter,
    }).populate("towerId", "towerName towerNumber");

    if (!outside) {
      return c.json(
        { success: false, message: "Outside record not found" },
        404
      );
    }

    return c.json({ success: true, data: outside });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateOutside = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "Outside id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid outside id" }, 400);
    }

    if (body.towerId && !isMongoId(body.towerId)) {
      return c.json({ success: false, message: "Invalid towerId" }, 400);
    }

    if (body.outsideName || body.towerId) {
      const currentOutside = await Outside.findOne({
        _id: id,
        ...scopeFilter,
      });

      if (!currentOutside) {
        return c.json(
          { success: false, message: "Outside record not found" },
          404
        );
      }

      const exists = await Outside.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        towerId: body.towerId || currentOutside.towerId,
        outsideName: body.outsideName || currentOutside.outsideName,
      });

      if (exists) {
        return c.json(
          {
            success: false,
            message: "Outside record already exists in this tower",
          },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;

    const outside = await Outside.findOneAndUpdate(
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

    if (!outside) {
      return c.json(
        { success: false, message: "Outside record not found" },
        404
      );
    }

    return c.json({
      success: true,
      message: "Outside record updated successfully",
      data: outside,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteOutside = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Outside id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid outside id" }, 400);
    }

    const outside = await Outside.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!outside) {
      return c.json(
        { success: false, message: "Outside record not found" },
        404
      );
    }

    return c.json({
      success: true,
      message: "Outside record deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};