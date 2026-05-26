import type { Context } from "hono";
import mongoose from "mongoose";
import { AttendancePolicy } from "./attendancePolicy.model";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

export const createAttendancePolicy = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    const {
      name,
      description,
      checkInTime,
      checkOutTime,
      graceMinutes,
      halfDayAfterMinutes,
      fullDayMinutes,
      allowLateCheckIn,
      allowEarlyCheckOut,
      requireGeofence,
      requireSelfie,
      allowRegularization,
      weeklyOffs = [],
    } = body;

    if (!name) {
      return c.json(
        {
          success: false,
          message: "name is required",
        },
        400
      );
    }

    const existingPolicy = await AttendancePolicy.findOne({
      organizationId: user.organizationId,
      name: name.trim(),
    });

    if (existingPolicy) {
      return c.json(
        {
          success: false,
          message: "Attendance policy already exists",
        },
        409
      );
    }

    const policy = await AttendancePolicy.create({
      organizationId: user.organizationId,
      name,
      description: description || null,
      checkInTime: checkInTime || "09:00",
      checkOutTime: checkOutTime || "18:00",
      graceMinutes: graceMinutes ?? 10,
      halfDayAfterMinutes: halfDayAfterMinutes ?? 240,
      fullDayMinutes: fullDayMinutes ?? 480,
      allowLateCheckIn: allowLateCheckIn ?? true,
      allowEarlyCheckOut: allowEarlyCheckOut ?? true,
      requireGeofence: requireGeofence ?? false,
      requireSelfie: requireSelfie ?? false,
      allowRegularization: allowRegularization ?? true,
      weeklyOffs,
    });

    return c.json(
      {
        success: true,
        message: "Attendance policy created successfully",
        data: policy,
      },
      201
    );
  } catch (error: any) {
    if (error.code === 11000) {
      return c.json(
        {
          success: false,
          message: "Attendance policy already exists",
        },
        409
      );
    }

    return c.json(
      {
        success: false,
        message: error.message,
      },
      400
    );
  }
};

export const getAttendancePolicies = async (c: Context) => {
  try {
    const user = c.get("user");

    const page = Math.max(Number(c.req.query("page")) || 1, 1);
    const limit = Math.max(Number(c.req.query("limit")) || 10, 1);
    const search = c.req.query("search") || "";

    const skip = (page - 1) * limit;

    const match: any = {
      organizationId: user.organizationId,
    };

    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      AttendancePolicy.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      AttendancePolicy.countDocuments(match),
    ]);

    return c.json({
      success: true,
      message: "Attendance policies fetched successfully",
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
      },
      400
    );
  }
};

export const getAttendancePolicyById = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json(
        {
          success: false,
          message: "Invalid attendance policy id",
        },
        400
      );
    }

    const policy = await AttendancePolicy.findOne({
      _id: id,
      organizationId: user.organizationId,
    });

    if (!policy) {
      return c.json(
        {
          success: false,
          message: "Attendance policy not found",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: policy,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
      },
      400
    );
  }
};

export const updateAttendancePolicy = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!isValidObjectId(id)) {
      return c.json(
        {
          success: false,
          message: "Invalid attendance policy id",
        },
        400
      );
    }

    const policy = await AttendancePolicy.findOne({
      _id: id,
      organizationId: user.organizationId,
    });

    if (!policy) {
      return c.json(
        {
          success: false,
          message: "Attendance policy not found",
        },
        404
      );
    }

    if (body.name && body.name !== policy.name) {
      const exists = await AttendancePolicy.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        name: body.name.trim(),
      });

      if (exists) {
        return c.json(
          {
            success: false,
            message: "Attendance policy already exists",
          },
          409
        );
      }

      policy.name = body.name;
    }

    if (body.description !== undefined) policy.description = body.description || null;
    if (body.checkInTime !== undefined) policy.checkInTime = body.checkInTime;
    if (body.checkOutTime !== undefined) policy.checkOutTime = body.checkOutTime;
    if (body.graceMinutes !== undefined) policy.graceMinutes = body.graceMinutes;
    if (body.halfDayAfterMinutes !== undefined) policy.halfDayAfterMinutes = body.halfDayAfterMinutes;
    if (body.fullDayMinutes !== undefined) policy.fullDayMinutes = body.fullDayMinutes;
    if (body.allowLateCheckIn !== undefined) policy.allowLateCheckIn = body.allowLateCheckIn;
    if (body.allowEarlyCheckOut !== undefined) policy.allowEarlyCheckOut = body.allowEarlyCheckOut;
    if (body.requireGeofence !== undefined) policy.requireGeofence = body.requireGeofence;
    if (body.requireSelfie !== undefined) policy.requireSelfie = body.requireSelfie;
    if (body.allowRegularization !== undefined) policy.allowRegularization = body.allowRegularization;
    if (body.weeklyOffs !== undefined) policy.weeklyOffs = body.weeklyOffs;
    if (body.isActive !== undefined) policy.isActive = body.isActive;

    await policy.save();

    return c.json({
      success: true,
      message: "Attendance policy updated successfully",
      data: policy,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
      },
      400
    );
  }
};

export const deleteAttendancePolicy = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json(
        {
          success: false,
          message: "Invalid attendance policy id",
        },
        400
      );
    }

    const policy = await AttendancePolicy.findOne({
      _id: id,
      organizationId: user.organizationId,
    });

    if (!policy) {
      return c.json(
        {
          success: false,
          message: "Attendance policy not found",
        },
        404
      );
    }

    policy.isActive = false;
    await policy.save();

    return c.json({
      success: true,
      message: "Attendance policy deleted successfully",
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
      },
      400
    );
  }
};