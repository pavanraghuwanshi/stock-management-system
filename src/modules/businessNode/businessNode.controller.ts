import type { Context } from "hono";
import mongoose from "mongoose";
import { BusinessNode } from "./businessNode.model";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

export const createBusinessNode = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    const { name, type, parentNodeId } = body;

    if (!name || !type) {
      return c.json(
        { success: false, message: "name and type are required" },
        400
      );
    }

    let ancestorNodeIds: any[] = [];

    if (parentNodeId) {
      if (!isValidObjectId(parentNodeId)) {
        return c.json({ success: false, message: "Invalid parentNodeId" }, 400);
      }

      const parentNode = await BusinessNode.findOne({
        _id: parentNodeId,
        organizationId: user.organizationId,
        isActive: true,
      });

      if (!parentNode) {
        return c.json({ success: false, message: "Parent node not found" }, 404);
      }

      ancestorNodeIds = [...parentNode.ancestorNodeIds, parentNode._id];
    }

    const node = await BusinessNode.create({
      organizationId: user.organizationId,
      name,
      type,
      parentNodeId: parentNodeId || null,
      ancestorNodeIds,
    });

    return c.json(
      {
        success: true,
        message: "Business node created successfully",
        data: node,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getAllBusinessNodes = async (c: Context) => {
  try {
    const user = c.get("user");

    const nodes = await BusinessNode.find({
      organizationId: user.organizationId,
      isActive: true,
    })
      .populate("parentNodeId", "name type")
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      count: nodes.length,
      data: nodes,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getBusinessNodeById = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid node id" }, 400);
    }

    const node = await BusinessNode.findOne({
      _id: id,
      organizationId: user.organizationId,
    }).populate("parentNodeId", "name type");

    if (!node) {
      return c.json({ success: false, message: "Business node not found" }, 404);
    }

    return c.json({ success: true, data: node });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateBusinessNode = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid node id" }, 400);
    }

    const node = await BusinessNode.findOne({
      _id: id,
      organizationId: user.organizationId,
    });

    if (!node) {
      return c.json({ success: false, message: "Business node not found" }, 404);
    }

    if (body.name !== undefined) node.name = body.name;
    if (body.type !== undefined) node.type = body.type;
    if (body.isActive !== undefined) node.isActive = body.isActive;

    await node.save();

    return c.json({
      success: true,
      message: "Business node updated successfully",
      data: node,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteBusinessNode = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid node id" }, 400);
    }

    const childCount = await BusinessNode.countDocuments({
      organizationId: user.organizationId,
      parentNodeId: id,
      isActive: true,
    });

    if (childCount > 0) {
      return c.json(
        {
          success: false,
          message: "This node has child nodes. Delete or move them first.",
        },
        400
      );
    }

    const node = await BusinessNode.findOne({
      _id: id,
      organizationId: user.organizationId,
    });

    if (!node) {
      return c.json({ success: false, message: "Business node not found" }, 404);
    }

    node.isActive = false;
    await node.save();

    return c.json({
      success: true,
      message: "Business node deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};