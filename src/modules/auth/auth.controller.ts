import type { Context } from "hono";
import jwt from "jsonwebtoken";

import { User } from "../User/user.model";
import { decryptPassword } from "../../utils/crypto";
import { UserDevice } from "../loginDeviceInfo/loginDevice.model";




const generateToken = (payload: any) => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

export const login = async (c: Context) => {
  try {
    const body = await c.req.json();

    const { emailOrMobile, password, deviceId } = body;

    if (!emailOrMobile || !password) {
      return c.json(
        {
          success: false,
          message: "emailOrMobile and password are required",
        },
        400
      );
    }

    const isMobile = /^[0-9]+$/.test(String(emailOrMobile));

    // ✅ mobile login
    if (isMobile) {
      const mobileUser = await User.findOne({
        mobile: String(emailOrMobile),
      });

      // mobile missing
      if (!mobileUser?.mobile) {
        return c.json(
          {
            success: false,
            message: "Mobile number not available. Please login using email",
          },
          400
        );
      }
    }

    const user = await User.findOne({
      $or: [
        {
          email: String(emailOrMobile).toLowerCase(),
        },
        {
          mobile: String(emailOrMobile),
        },
      ],

      isActive: true,
    })
      .select("+password")
      .populate("roleId", "name permissions scope")
      .populate("nodeIds", "name type")
      .populate("primaryNodeId", "name type");

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Invalid credentials",
        },
        401
      );
    }

    let decryptedPassword = "";

    try {
      decryptedPassword = decryptPassword(user.password as any);
    } catch {
      return c.json(
        {
          success: false,
          message: "Password decryption failed",
        },
        500
      );
    }

    if (decryptedPassword !== password) {
      return c.json(
        {
          success: false,
          message: "Invalid credentials",
        },
        401
      );
    }

    const roleName = (user.roleId as any)?.name || "";

    // ✅ skip for superadmin & organization
    if (roleName !== "superAdmin" && roleName !== "organization") {
      const existingDevice = await UserDevice.findOne({
        userId: user._id,
      });

      if (existingDevice) {
        if (!deviceId) {
          return c.json(
            {
              success: false,
              message: "deviceId is required",
            },
            400
          );
        }

        // already saved device check
        if (existingDevice.deviceId !== deviceId) {
          return c.json(
            {
              success: false,
              message: "Please login with your real device",
            },
            403
          );
        }
      }
    }

    const token = generateToken({
      id: user._id,
      organizationId: user.organizationId,
    });

    const userObj: any = user.toObject();

    delete userObj.password;

    return c.json({
      success: true,
      message: "Login successful",
      token,
      data: userObj,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || "Login failed",
      },
      400
    );
  }
};

export const me = async (c: Context) => {
  try {
    const user = c.get("user");

    return c.json({
      success: true,
      data: user,
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