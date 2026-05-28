// advance.controller.ts

import type { Context } from "hono";
import mongoose from "mongoose";
import { Advance } from "./advance.model";
import { User } from "../User/user.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const getLoggedInUserId = (user: any) => user?._id || user?.id;

const buildAdvanceScopeFilter = async (loggedInUser: any) => {
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

export const createAdvance = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const body = await c.req.json();

    const { userId, amount, reason, advanceDate, note } = body;

    if (!userId || amount === undefined || !reason) {
      return c.json(
        {
          success: false,
          message: "userId, amount and reason are required",
        },
        400
      );
    }

    if (!isValidObjectId(userId)) {
      return c.json({ success: false, message: "Invalid userId" }, 400);
    }

    if (Number(amount) <= 0) {
      return c.json(
        {
          success: false,
          message: "Amount must be greater than 0",
        },
        400
      );
    }

    const scopeFilter = await buildAdvanceScopeFilter(loggedInUser);

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

    const advance = await Advance.create({
      organizationId: loggedInUser.organizationId,
      userId,
      nodeId: user.nodeIds?.[0] || null,
      amount: Number(amount),
      reason,
      advanceDate: advanceDate ? new Date(advanceDate) : new Date(),
      note: note || null,
      status: "Active",
      givenBy: getLoggedInUserId(loggedInUser),
    });

    return c.json(
      {
        success: true,
        message: "Advance created successfully",
        data: advance,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getAllAdvances = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const {
      page = "1",
      limit = "10",
      status,
      userId,
      nodeId,
      search,
      startDate,
      endDate,
    } = c.req.query();

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.max(Number(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const filter: any = await buildAdvanceScopeFilter(loggedInUser);

    if (status) filter.status = status;

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
      filter.advanceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (search) {
      const users = await User.find({
        organizationId: loggedInUser.organizationId,
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      filter.$or = [
        { reason: { $regex: search, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
        { userId: { $in: users.map((u) => u._id) } },
      ];
    }

    const [advances, total] = await Promise.all([
      Advance.find(filter)
        .populate("userId", "name email mobile role nodeIds")
        .populate("nodeId", "name type")
        .populate("givenBy", "name email")
        .populate("settledBy", "name email")
        .sort({ advanceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Advance.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      message: "Advances fetched successfully",
      data: advances,
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

export const getMyAdvances = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const advances = await Advance.find({
      organizationId: loggedInUser.organizationId,
      userId: getLoggedInUserId(loggedInUser),
    })
      .populate("nodeId", "name type")
      .populate("givenBy", "name email")
      .populate("settledBy", "name email")
      .sort({ advanceDate: -1, createdAt: -1 });

    return c.json({
      success: true,
      message: "My advances fetched successfully",
      data: advances,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getAdvanceById = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid advance id" }, 400);
    }

    const filter = await buildAdvanceScopeFilter(loggedInUser);

    const advance = await Advance.findOne({
      _id: id,
      ...filter,
    })
      .populate("userId", "name email mobile role nodeIds")
      .populate("nodeId", "name type")
      .populate("givenBy", "name email")
      .populate("settledBy", "name email");

    if (!advance) {
      return c.json(
        {
          success: false,
          message: "Advance not found in your CRM scope",
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "Advance fetched successfully",
      data: advance,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const updateAdvance = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    const { amount, reason, advanceDate, note } = body;

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid advance id" }, 400);
    }

    const filter = await buildAdvanceScopeFilter(loggedInUser);

    const advance = await Advance.findOne({
      _id: id,
      ...filter,
    });

    if (!advance) {
      return c.json(
        {
          success: false,
          message: "Advance not found in your CRM scope",
        },
        404
      );
    }

    if (advance.status !== "Active") {
      return c.json(
        {
          success: false,
          message: "Only active advance can be updated",
        },
        400
      );
    }

    if (amount !== undefined) {
      if (Number(amount) <= 0) {
        return c.json(
          {
            success: false,
            message: "Amount must be greater than 0",
          },
          400
        );
      }

      advance.amount = Number(amount);
    }

    if (reason) advance.reason = reason;
    if (advanceDate) advance.advanceDate = new Date(advanceDate);
    if (note !== undefined) advance.note = note || null;

    await advance.save();

    return c.json({
      success: true,
      message: "Advance updated successfully",
      data: advance,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const settleAdvance = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid advance id" }, 400);
    }

    const filter = await buildAdvanceScopeFilter(loggedInUser);

    const advance = await Advance.findOne({
      _id: id,
      ...filter,
    });

    if (!advance) {
      return c.json(
        {
          success: false,
          message: "Advance not found in your CRM scope",
        },
        404
      );
    }

    if (advance.status !== "Active") {
      return c.json(
        {
          success: false,
          message: `Advance already ${advance.status}`,
        },
        400
      );
    }

    advance.status = "Settled";
    advance.settledAt = new Date();
    advance.settledBy = getLoggedInUserId(loggedInUser);

    await advance.save();

    return c.json({
      success: true,
      message: "Advance settled successfully",
      data: advance,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const cancelAdvance = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid advance id" }, 400);
    }

    const filter = await buildAdvanceScopeFilter(loggedInUser);

    const advance = await Advance.findOne({
      _id: id,
      ...filter,
    });

    if (!advance) {
      return c.json(
        {
          success: false,
          message: "Advance not found in your CRM scope",
        },
        404
      );
    }

    if (advance.status !== "Active") {
      return c.json(
        {
          success: false,
          message: "Only active advance can be cancelled",
        },
        400
      );
    }

    advance.status = "Cancelled";

    await advance.save();

    return c.json({
      success: true,
      message: "Advance cancelled successfully",
      data: advance,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const deleteAdvance = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid advance id" }, 400);
    }

    const filter = await buildAdvanceScopeFilter(loggedInUser);

    const advance = await Advance.findOneAndDelete({
      _id: id,
      ...filter,
    });

    if (!advance) {
      return c.json(
        {
          success: false,
          message: "Advance not found in your CRM scope",
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "Advance deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};