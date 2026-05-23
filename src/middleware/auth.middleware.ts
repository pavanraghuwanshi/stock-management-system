import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";

import { User } from "../modules/User/user.model";


export const auth = async (c: Context, next: Next) => {
  try {
    const authorization = c.req.header("Authorization");

    if (!authorization) {
      return c.json(
        {
          success: false,
          message: "Authorization token missing",
        },
        401
      );
    }

    if (!authorization.startsWith("Bearer ")) {
      return c.json(
        {
          success: false,
          message: "Invalid authorization format",
        },
        401
      );
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      return c.json(
        {
          success: false,
          message: "Token missing",
        },
        401
      );
    }

    let decoded: any;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      );
    } catch {
      return c.json(
        {
          success: false,
          message: "Invalid or expired token",
        },
        401
      );
    }

    const user = await User.findOne({
      _id: decoded.id,
      isActive: true,
    })
      .populate("roleId", "name permissions scope")
      .populate("unitIds", "name type")
      .populate("primaryUnitId", "name type");

    if (!user) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404
      );
    }

    c.set("user", user);

    await next();
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message || "Unauthorized",
      },
      401
    );
  }
};