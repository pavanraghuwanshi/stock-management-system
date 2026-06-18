import type { Context } from "hono";
import mongoose from "mongoose";
import { Unit } from "./unit.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isMongoId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

const buildUnitScopeFilter = (user: any) => {
  const scope = user?.scope || user?.role?.scope || user?.roleId?.scope;
  const userId = user?._id || user?.id;

  const filter: any = {
    organizationId: user.organizationId,
  };

  if (scope === "organization") {
    return filter;
  }

  if (scope === "team") {
    return filter;
  }

  filter.ownerId = userId;
  return filter;
};

export const createUnit = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.label || !body.value) {
      return c.json(
        { success: false, message: "label and value are required" },
        400
      );
    }

    const exists = await Unit.findOne({
      organizationId: user.organizationId,
      value: body.value,
    });

    if (exists) {
      return c.json(
        { success: false, message: "Unit value already exists" },
        409
      );
    }

    const unit = await Unit.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id || user.id,
      createdBy: user._id || user.id,
    });

    return c.json(
      {
        success: true,
        message: "Unit created successfully",
        data: unit,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getUnits = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = buildUnitScopeFilter(user);

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const status = c.req.query("status");

    const skip = (page - 1) * limit;

    const query: any = { ...scopeFilter };

    if (search) {
      query.$or = [
        { label: { $regex: search, $options: "i" } },
        { value: { $regex: search, $options: "i" } },
      ];
    }

    if (status) query.status = status;

    const total = await Unit.countDocuments(query);

    const units = await Unit.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      data: units,
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

export const getUnitById = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = buildUnitScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Unit id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid unit id" }, 400);
    }

    const unit = await Unit.findOne({
      _id: id,
      ...scopeFilter,
    });

    if (!unit) {
      return c.json({ success: false, message: "Unit not found" }, 404);
    }

    return c.json({ success: true, data: unit });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateUnit = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = buildUnitScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "Unit id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid unit id" }, 400);
    }

    if (body.value) {
      const exists = await Unit.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        value: body.value,
      });

      if (exists) {
        return c.json(
          { success: false, message: "Unit value already exists" },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;

    const unit = await Unit.findOneAndUpdate(
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

    if (!unit) {
      return c.json({ success: false, message: "Unit not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Unit updated successfully",
      data: unit,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteUnit = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = buildUnitScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Unit id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid unit id" }, 400);
    }

    const unit = await Unit.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!unit) {
      return c.json({ success: false, message: "Unit not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Unit deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};