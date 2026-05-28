import type { Context } from "hono";
import mongoose from "mongoose";
import { Leave } from "./leave.model";
import { User } from "../User/user.model";
import { BusinessNode } from "../businessNode/businessNode.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const getLoggedInUserId = (user: any) => user?._id || user?.id;

const getUserNodeId = (user: any) => {
  return user?.nodeId || user?.nodeIds?.[0] || null;
};

const calculateTotalDays = (startDate: Date, endDate: Date) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
};

const buildLeaveScopeFilter = async (loggedInUser: any) => {
  const scopeFilter: any = await buildScopeFilter(loggedInUser);

  const filter: any = {
    organizationId: scopeFilter.organizationId,
  };

  if (scopeFilter.ownerId?.$in) {
    filter.userId = { $in: scopeFilter.ownerId.$in };
  } else if (scopeFilter.ownerId) {
    filter.userId = scopeFilter.ownerId;
  }

  if (scopeFilter.nodeId) {
    filter.nodeId = scopeFilter.nodeId;
  }

  return filter;
};

export const applyLeave = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const body = await c.req.json();

    const { leaveType, startDate, endDate, reason, nodeId } = body;

    if (!startDate || !endDate || !reason) {
      return c.json(
        {
          success: false,
          message: "startDate, endDate and reason are required",
        },
        400
      );
    }

    const loggedInUserId = getLoggedInUserId(loggedInUser);
    const userNodeId = nodeId || getUserNodeId(loggedInUser);

    if (!loggedInUserId || !isValidObjectId(loggedInUserId)) {
      return c.json({ success: false, message: "Invalid logged in user" }, 400);
    }

    if (userNodeId && !isValidObjectId(userNodeId)) {
      return c.json({ success: false, message: "Invalid nodeId" }, 400);
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (parsedEndDate < parsedStartDate) {
      return c.json(
        {
          success: false,
          message: "endDate must be greater than or equal to startDate",
        },
        400
      );
    }

    if (userNodeId) {
      const node = await BusinessNode.findOne({
        _id: userNodeId,
        organizationId: loggedInUser.organizationId,
        isActive: true,
      });

      if (!node) {
        return c.json(
          {
            success: false,
            message: "Invalid CRM node",
          },
          400
        );
      }
    }

    const totalDays = calculateTotalDays(parsedStartDate, parsedEndDate);

    const leave = await Leave.create({
      organizationId: loggedInUser.organizationId,
      userId: loggedInUserId,
      nodeId: userNodeId,
      leaveType: leaveType || "Casual",
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      totalDays,
      reason,
      status: "Pending",
      appliedBy: loggedInUserId,
    });

    return c.json(
      {
        success: true,
        message: "Leave applied successfully",
        data: leave,
      },
      201
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
      },
      500
    );
  }
};

export const createLeaveForUser = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const body = await c.req.json();

    const { userId, leaveType, startDate, endDate, reason, status } = body;

    if (!userId || !startDate || !endDate || !reason) {
      return c.json(
        {
          success: false,
          message: "userId, startDate, endDate and reason are required",
        },
        400
      );
    }

    if (!isValidObjectId(userId)) {
      return c.json({ success: false, message: "Invalid userId" }, 400);
    }

    const scopeFilter = await buildLeaveScopeFilter(loggedInUser);

    const user = await User.findOne({
      _id: userId,
      ...scopeFilter,
    });

    if (!user) {
      return c.json(
        {
          success: false,
          message: "User not found in your CRM scope",
        },
        404
      );
    }

    const userNodeId = user.nodeIds?.[0] || null;

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (parsedEndDate < parsedStartDate) {
      return c.json(
        {
          success: false,
          message: "endDate must be greater than or equal to startDate",
        },
        400
      );
    }

    const finalStatus = ["Pending", "Approved"].includes(status)
      ? status
      : "Pending";

    const loggedInUserId = getLoggedInUserId(loggedInUser);

    const leave = await Leave.create({
      organizationId: loggedInUser.organizationId,
      userId,
      nodeId: userNodeId,
      leaveType: leaveType || "Casual",
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      totalDays: calculateTotalDays(parsedStartDate, parsedEndDate),
      reason,
      status: finalStatus,
      appliedBy: loggedInUserId,
      approvedBy: finalStatus === "Approved" ? loggedInUserId : null,
      approvedAt: finalStatus === "Approved" ? new Date() : null,
    });

    return c.json(
      {
        success: true,
        message: "Leave created successfully",
        data: leave,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getAllLeaves = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const {
      page = "1",
      limit = "10",
      status,
      userId,
      nodeId,
      leaveType,
      startDate,
      endDate,
      search,
    } = c.req.query();

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.max(Number(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const filter: any = await buildLeaveScopeFilter(loggedInUser);

    if (status) filter.status = status;
    if (leaveType) filter.leaveType = leaveType;

    if (userId) {
      if (!isValidObjectId(userId)) {
        return c.json({ success: false, message: "Invalid userId" }, 400);
      }

      filter.userId = new mongoose.Types.ObjectId(userId);
    }

    if (nodeId) {
      if (!isValidObjectId(nodeId)) {
        return c.json({ success: false, message: "Invalid nodeId" }, 400);
      }

      filter.nodeId = new mongoose.Types.ObjectId(nodeId);
    }

    if (startDate && endDate) {
      filter.startDate = {
        $gte: new Date(startDate),
      };

      filter.endDate = {
        $lte: new Date(endDate),
      };
    }

    let userSearchIds: any[] = [];

    if (search) {
      const users = await User.find({
        organizationId: loggedInUser.organizationId,
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      userSearchIds = users.map((u) => u._id);

      filter.$or = [
        { reason: { $regex: search, $options: "i" } },
        { userId: { $in: userSearchIds } },
      ];
    }

    const [leaves, total] = await Promise.all([
      Leave.find(filter)
        .populate("userId", "name email mobile role nodeId nodeIds")
        .populate("nodeId", "name type")
        .populate("approvedBy", "name email")
        .populate("rejectedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Leave.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      message: "Leaves fetched successfully",
      data: leaves,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getMyLeaves = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const leaves = await Leave.find({
      organizationId: loggedInUser.organizationId,
      userId: getLoggedInUserId(loggedInUser),
    })
      .populate("nodeId", "name type")
      .populate("approvedBy", "name email")
      .populate("rejectedBy", "name email")
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      message: "My leaves fetched successfully",
      data: leaves,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getLeaveById = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid leave id" }, 400);
    }

    const filter = await buildLeaveScopeFilter(loggedInUser);

    const leave = await Leave.findOne({
      _id: id,
      ...filter,
    })
      .populate("userId", "name email mobile role nodeId nodeIds")
      .populate("nodeId", "name type")
      .populate("approvedBy", "name email")
      .populate("rejectedBy", "name email");

    if (!leave) {
      return c.json(
        {
          success: false,
          message: "Leave not found in your CRM scope",
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "Leave fetched successfully",
      data: leave,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const updateLeave = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid leave id" }, 400);
    }

    const leave = await Leave.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
      userId: getLoggedInUserId(loggedInUser),
    });

    if (!leave) {
      return c.json(
        {
          success: false,
          message: "Only leave owner can update own leave",
        },
        404
      );
    }

    if (leave.status !== "Pending") {
      return c.json(
        {
          success: false,
          message: "Only pending leave can be updated",
        },
        400
      );
    }

    const { leaveType, startDate, endDate, reason } = body;

    if (leaveType) leave.leaveType = leaveType;
    if (reason) leave.reason = reason;

    if (startDate) leave.startDate = new Date(startDate);
    if (endDate) leave.endDate = new Date(endDate);

    if (leave.endDate < leave.startDate) {
      return c.json(
        {
          success: false,
          message: "endDate must be greater than or equal to startDate",
        },
        400
      );
    }

    leave.totalDays = calculateTotalDays(leave.startDate, leave.endDate);

    await leave.save();

    return c.json({
      success: true,
      message: "Leave updated successfully",
      data: leave,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const approveRejectLeave = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    const { status, rejectionReason } = body;

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid leave id" }, 400);
    }

    if (!["Approved", "Rejected"].includes(status)) {
      return c.json(
        {
          success: false,
          message: "status must be Approved or Rejected",
        },
        400
      );
    }

    const filter = await buildLeaveScopeFilter(loggedInUser);

    const leave = await Leave.findOne({
      _id: id,
      ...filter,
    });

    if (!leave) {
      return c.json(
        {
          success: false,
          message: "Leave not found in your approval scope",
        },
        404
      );
    }

    const loggedInUserId = String(getLoggedInUserId(loggedInUser));

    if (String(leave.userId) === loggedInUserId) {
      return c.json(
        {
          success: false,
          message: "You cannot approve or reject your own leave",
        },
        403
      );
    }

    if (leave.status !== "Pending") {
      return c.json(
        {
          success: false,
          message: `Leave already ${leave.status}`,
        },
        400
      );
    }

    leave.status = status;

    if (status === "Approved") {
      leave.approvedBy = new mongoose.Types.ObjectId(loggedInUserId);
      leave.approvedAt = new Date();
      leave.rejectedBy = null;
      leave.rejectedAt = null;
      leave.rejectionReason = null;
    }

    if (status === "Rejected") {
      leave.rejectedBy = new mongoose.Types.ObjectId(loggedInUserId);
      leave.rejectedAt = new Date();
      leave.rejectionReason = rejectionReason || null;
      leave.approvedBy = null;
      leave.approvedAt = null;
    }

    await leave.save();

    return c.json({
      success: true,
      message: `Leave ${status.toLowerCase()} successfully`,
      data: leave,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const cancelLeave = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid leave id" }, 400);
    }

    const leave = await Leave.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
      userId: getLoggedInUserId(loggedInUser),
    });

    if (!leave) {
      return c.json(
        {
          success: false,
          message: "Leave not found",
        },
        404
      );
    }

    if (leave.status !== "Pending") {
      return c.json(
        {
          success: false,
          message: "Only pending leave can be cancelled",
        },
        400
      );
    }

    leave.status = "Cancelled";
    await leave.save();

    return c.json({
      success: true,
      message: "Leave cancelled successfully",
      data: leave,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const deleteLeave = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid leave id" }, 400);
    }

    const filter = await buildLeaveScopeFilter(loggedInUser);

    const leave = await Leave.findOneAndDelete({
      _id: id,
      ...filter,
    });

    if (!leave) {
      return c.json(
        {
          success: false,
          message: "Leave not found in your CRM scope",
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "Leave deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};