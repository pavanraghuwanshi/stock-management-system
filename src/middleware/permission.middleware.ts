import type { Context, Next } from "hono";

export const checkPermission = (permission: string) => {
  return async (c: Context, next: Next) => {
    try {
      const user: any = c.get("user");

      if (!user?.roleId) {
        return c.json(
          {
            success: false,
            message: "Role not found",
          },
          403
        );
      }

      const role = user.roleId;

      if (!role.permissions || !Array.isArray(role.permissions)) {
        return c.json(
          {
            success: false,
            message: "Permissions not configured",
          },
          403
        );
      }

      const hasPermission =
        role.permissions.includes("*") ||
        role.permissions.includes(permission);

      if (!hasPermission) {
        return c.json(
          {
            success: false,
            message: "Permission denied",
          },
          403
        );
      }

      await next();
    } catch (error: any) {
      return c.json(
        {
          success: false,
          message: error.message || "Permission validation failed",
        },
        403
      );
    }
  };
};