// device.controller.ts

import type { Context } from "hono";
import mongoose from "mongoose";
import { UserDevice } from "./loginDevice.model";
import { User } from "../User/user.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const buildDeviceScopeFilter = async (loggedInUser: any) => {
  const scopeFilter: any = await buildScopeFilter(loggedInUser);

  const filter: any = {
    organizationId: scopeFilter.organizationId,
  };

  if (scopeFilter.ownerId?.$in) {
    filter.userId = { $in: scopeFilter.ownerId.$in };
  } else if (scopeFilter.ownerId) {
    filter.userId = scopeFilter.ownerId;
  }

  return filter;
};

// save device api


export const saveUserDevice = async (c: Context) => {
  try {
    const user = c.get("user");

    // ✅ skip for superadmin / organization owner
    if (
      user?.roleName === "superAdmin" ||
      user?.roleName === "organization"
    ) {
      return c.json({
        success: true,
        message: "Device restriction skipped",
      });
    }

    const body = await c.req.json();

    const {
      deviceId,
      deviceName,
      deviceModel,
      platform,
      osVersion,
      appVersion,
    } = body;

    if (!deviceId) {
      return c.json(
        {
          success: false,
          message: "deviceId is required",
        },
        400
      );
    }

    const ipAddress =
      c.req.header("x-forwarded-for") ||
      c.req.header("x-real-ip") ||
      null;

    const existing = await UserDevice.findOne({
      userId: user._id,
    });

    // first time login device save
    if (!existing) {
      const newDevice = await UserDevice.create({
        organizationId: user.organizationId,
        userId: user._id,
        deviceId,
        deviceName,
        deviceModel,
        platform,
        osVersion,
        appVersion,
        ipAddress,
        lastLoginAt: new Date(),
      });

      return c.json({
        success: true,
        message: "Device saved successfully",
        data: newDevice,
      });
    }

    // device mismatch
    if (existing.deviceId !== deviceId) {
      return c.json(
        {
          success: false,
          message:
            "Please login with your real device",
        },
        403
      );
    }

    // update login info
    existing.deviceName = deviceName || existing.deviceName;
    existing.deviceModel = deviceModel || existing.deviceModel;
    existing.platform = platform || existing.platform;
    existing.osVersion = osVersion || existing.osVersion;
    existing.appVersion = appVersion || existing.appVersion;
    existing.ipAddress = ipAddress || existing.ipAddress;
    existing.lastLoginAt = new Date();

    await existing.save();

    return c.json({
      success: true,
      message: "Device verified successfully",
    });
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

export const getAllUserDevices = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const { page = "1", limit = "10", search, userId } = c.req.query();

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.max(Number(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const filter: any = await buildDeviceScopeFilter(loggedInUser);

    if (userId) {
      if (!isValidObjectId(userId)) {
        return c.json({ success: false, message: "Invalid userId" }, 400);
      }

      filter.userId = new mongoose.Types.ObjectId(userId);
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
        { deviceId: { $regex: search, $options: "i" } },
        { deviceName: { $regex: search, $options: "i" } },
        { deviceModel: { $regex: search, $options: "i" } },
        { platform: { $regex: search, $options: "i" } },
        { userId: { $in: users.map((u) => u._id) } },
      ];
    }

    const [devices, total] = await Promise.all([
      UserDevice.find(filter)
        .populate("userId", "name email mobile role nodeIds")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      UserDevice.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      message: "User devices fetched successfully",
      data: devices,
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

export const getUserDeviceByUserId = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const userId = c.req.param("userId");

    if (!isValidObjectId(userId)) {
      return c.json({ success: false, message: "Invalid userId" }, 400);
    }

    const filter: any = await buildDeviceScopeFilter(loggedInUser);
    filter.userId = new mongoose.Types.ObjectId(userId);

    const device = await UserDevice.findOne(filter).populate(
      "userId",
      "name email mobile role nodeIds"
    );

    if (!device) {
      return c.json(
        {
          success: false,
          message: "Device not found for this user",
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "User device fetched successfully",
      data: device,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const updateUserDevice = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const userId = c.req.param("userId");
    const body = await c.req.json();

    if (!isValidObjectId(userId)) {
      return c.json({ success: false, message: "Invalid userId" }, 400);
    }

    const filter: any = await buildDeviceScopeFilter(loggedInUser);
    filter.userId = new mongoose.Types.ObjectId(userId);

    const device = await UserDevice.findOne(filter);

    if (!device) {
      return c.json(
        {
          success: false,
          message: "Device not found in your CRM scope",
        },
        404
      );
    }

    const {
      deviceId,
      deviceName,
      deviceModel,
      platform,
      osVersion,
      appVersion,
    } = body;

    if (deviceId !== undefined) device.deviceId = deviceId;
    if (deviceName !== undefined) device.deviceName = deviceName || null;
    if (deviceModel !== undefined) device.deviceModel = deviceModel || null;
    if (platform !== undefined) device.platform = platform || null;
    if (osVersion !== undefined) device.osVersion = osVersion || null;
    if (appVersion !== undefined) device.appVersion = appVersion || null;

    await device.save();

    return c.json({
      success: true,
      message: "User device updated successfully",
      data: device,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const resetUserDevice = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const userId = c.req.param("userId");

    if (!isValidObjectId(userId)) {
      return c.json({ success: false, message: "Invalid userId" }, 400);
    }

    const filter: any = await buildDeviceScopeFilter(loggedInUser);
    filter.userId = new mongoose.Types.ObjectId(userId);

    const device = await UserDevice.findOneAndDelete(filter);

    if (!device) {
      return c.json(
        {
          success: false,
          message: "Device not found in your CRM scope",
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "Device reset successfully. User can login with new device now.",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};