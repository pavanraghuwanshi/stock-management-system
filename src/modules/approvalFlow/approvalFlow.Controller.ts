import type { Context } from "hono";
import mongoose from "mongoose";
import { ApprovalFlow } from "./approvalFlow.model";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const getUserScope = (user: any) => {
  return user?.scope || user?.role?.scope || user?.roleId?.scope;
};

const isOrganizationAdmin = (user: any) => {
  return getUserScope(user) === "organization";
};

export const createApprovalFlow = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!isOrganizationAdmin(user)) {
      return c.json(
        { success: false, message: "Only organization admin can create approval flow" },
        403
      );
    }

    const { flowName, moduleName, status = "active", levels = [] } = body;

    if (!flowName || !moduleName) {
      return c.json(
        { success: false, message: "flowName and moduleName are required" },
        400
      );
    }

    if (!["indent", "purchaseOrder"].includes(moduleName)) {
      return c.json({ success: false, message: "Invalid moduleName" }, 400);
    }

    if (!Array.isArray(levels) || levels.length === 0) {
      return c.json(
        { success: false, message: "At least one approval level is required" },
        400
      );
    }

    for (const item of levels) {
      if (!item.level || !item.roleId) {
        return c.json(
          { success: false, message: "level and roleId are required" },
          400
        );
      }

      if (!isValidObjectId(item.roleId)) {
        return c.json({ success: false, message: "Invalid roleId" }, 400);
      }
    }

    if (status === "active") {
      await ApprovalFlow.updateMany(
        {
          organizationId: user.organizationId,
          moduleName,
          isActive: true,
        },
        { status: "inactive" }
      );
    }

    const flow = await ApprovalFlow.create({
      organizationId: user.organizationId,
      flowName,
      moduleName,
      status,
      levels: levels.sort((a: any, b: any) => a.level - b.level),
    });

    return c.json(
      {
        success: true,
        message: "Approval flow created successfully",
        data: flow,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getApprovalFlows = async (c: Context) => {
  try {
    const user = c.get("user");
    const { moduleName, status } = c.req.query();

    const filter: any = {
      organizationId: user.organizationId,
      isActive: true,
    };

    if (moduleName) filter.moduleName = moduleName;
    if (status) filter.status = status;

    const flows = await ApprovalFlow.find(filter)
      .populate("levels.roleId", "name scope")
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      count: flows.length,
      data: flows,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateApprovalFlow = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!isOrganizationAdmin(user)) {
      return c.json(
        { success: false, message: "Only organization admin can update approval flow" },
        403
      );
    }

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid flow id" }, 400);
    }

    const flow = await ApprovalFlow.findOne({
      _id: id,
      organizationId: user.organizationId,
      isActive: true,
    });

    if (!flow) {
      return c.json({ success: false, message: "Approval flow not found" }, 404);
    }

    const { flowName, moduleName, status, levels } = body;

    if (flowName !== undefined) flow.flowName = flowName;
    if (moduleName !== undefined) flow.moduleName = moduleName;
    if (status !== undefined) flow.status = status;

    if (levels !== undefined) {
      if (!Array.isArray(levels) || levels.length === 0) {
        return c.json(
          { success: false, message: "At least one approval level is required" },
          400
        );
      }

      flow.levels = levels.sort((a: any, b: any) => a.level - b.level) as any;
    }

    if (status === "active") {
      await ApprovalFlow.updateMany(
        {
          _id: { $ne: flow._id },
          organizationId: user.organizationId,
          moduleName: flow.moduleName,
          isActive: true,
        },
        { status: "inactive" }
      );
    }

    await flow.save();

    return c.json({
      success: true,
      message: "Approval flow updated successfully",
      data: flow,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteApprovalFlow = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!isOrganizationAdmin(user)) {
      return c.json(
        { success: false, message: "Only organization admin can delete approval flow" },
        403
      );
    }

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid flow id" }, 400);
    }

    const flow = await ApprovalFlow.findOne({
      _id: id,
      organizationId: user.organizationId,
      isActive: true,
    });

    if (!flow) {
      return c.json({ success: false, message: "Approval flow not found" }, 404);
    }

    flow.isActive = false;
    await flow.save();

    return c.json({
      success: true,
      message: "Approval flow deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};