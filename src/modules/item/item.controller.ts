import type { Context } from "hono";
import mongoose from "mongoose";
import { Item } from "./item.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isMongoId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

export const createItem = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.itemCode || !body.itemName) {
      return c.json(
        { success: false, message: "itemCode and itemName are required" },
        400
      );
    }

    const exists = await Item.findOne({
      organizationId: user.organizationId,
      itemCode: body.itemCode,
    });

    if (exists) {
      return c.json(
        { success: false, message: "Item code already exists" },
        409
      );
    }

    const item = await Item.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id,
      createdBy: user._id,
    });

    return c.json(
      {
        success: true,
        message: "Item created successfully",
        data: item,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getItems = async (c: Context) => {
  try {
    const user = c.get("user");

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const blockItem = c.req.query("blockItem");
    const unitId = c.req.query("unitId");
    const groupId = c.req.query("groupId");
    const subGroupId = c.req.query("subGroupId");

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
        { itemName: { $regex: search, $options: "i" } },
        { itemCode: { $regex: search, $options: "i" } },
        { HSNcode: { $regex: search, $options: "i" } },
        { newItemCode: { $regex: search, $options: "i" } },
      ];
    }

    if (blockItem) {
      query.blockItem = blockItem === "true";
    }

    if (unitId) {
      if (!isMongoId(unitId)) {
        return c.json({ success: false, message: "Invalid unitId" }, 400);
      }
      query.unitId = unitId;
    }

    if (groupId) {
      if (!isMongoId(groupId)) {
        return c.json({ success: false, message: "Invalid groupId" }, 400);
      }
      query.groupId = groupId;
    }

    if (subGroupId) {
      if (!isMongoId(subGroupId)) {
        return c.json({ success: false, message: "Invalid subGroupId" }, 400);
      }
      query.subGroupId = subGroupId;
    }

    const total = await Item.countDocuments(query);

    const items = await Item.find(query)
      .populate("unitId")
      .populate("groupId")
      .populate("subGroupId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return c.json({
      success: true,
      data: items,
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

export const getItemById = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Item id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid item id" }, 400);
    }

    if (!user?.organizationId) {
      return c.json(
        { success: false, message: "organizationId not found in token" },
        400
      );
    }

    const item = await Item.findOne({
      _id: id,
      organizationId: user.organizationId,
    })
      .populate("unitId")
      .populate("groupId")
      .populate("subGroupId");

    if (!item) {
      return c.json({ success: false, message: "Item not found" }, 404);
    }

    return c.json({
      success: true,
      data: item,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateItem = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "Item id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid item id" }, 400);
    }

    if (body.unitId && !isMongoId(body.unitId)) {
      return c.json({ success: false, message: "Invalid unitId" }, 400);
    }

    if (body.groupId && !isMongoId(body.groupId)) {
      return c.json({ success: false, message: "Invalid groupId" }, 400);
    }

    if (body.subGroupId && !isMongoId(body.subGroupId)) {
      return c.json({ success: false, message: "Invalid subGroupId" }, 400);
    }

    if (body.itemCode) {
      const exists = await Item.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        itemCode: body.itemCode,
      });

      if (exists) {
        return c.json(
          { success: false, message: "Item code already exists" },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;
    delete body.categoryId;

    const item = await Item.findOneAndUpdate(
      {
        _id: id,
        ...scopeFilter,
      },
      body,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("unitId")
      .populate("groupId")
      .populate("subGroupId");

    if (!item) {
      return c.json({ success: false, message: "Item not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Item updated successfully",
      data: item,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteItem = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Item id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid item id" }, 400);
    }

    const item = await Item.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!item) {
      return c.json({ success: false, message: "Item not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};