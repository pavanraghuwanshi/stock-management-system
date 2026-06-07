import type { Context } from "hono";
import mongoose from "mongoose";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Indent } from "./indent.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const getLoggedInUserId = (user: any) => user?._id || user?.id;

const getUserScope = (user: any) => {
  return user?.scope || user?.role?.scope || user?.roleId?.scope;
};

const canManageIndentStatus = (user: any) => {
  return getUserScope(user) === "organization";
};

const buildIndentScopeFilter = async (loggedInUser: any) => {
  const scope = getUserScope(loggedInUser);
  const loggedInUserId = getLoggedInUserId(loggedInUser);

  const filter: any = {
    organizationId: loggedInUser.organizationId,
  };

  if (scope === "organization") {
    return filter;
  }

  if (scope === "team") {
    const scopeFilter: any = await buildScopeFilter(loggedInUser);

    if (scopeFilter.ownerId?.$in) {
      filter.userId = { $in: scopeFilter.ownerId.$in };
    } else if (scopeFilter.ownerId) {
      filter.userId = scopeFilter.ownerId;
    } else {
      filter.userId = loggedInUserId;
    }

    return filter;
  }

  filter.userId = loggedInUserId;
  return filter;
};

const generateIndentId = async (organizationId: string) => {
  const count = await Indent.countDocuments({ organizationId });
  return `IND-${String(count + 1).padStart(3, "0")}`;
};

const uploadIndentImages = async (files: any) => {
  if (!files) return [];

  const fileArray = Array.isArray(files) ? files : [files];

  const uploadDir = path.join(process.cwd(), "public", "uploads", "indents");
  await mkdir(uploadDir, { recursive: true });

  const images = [];

  for (const file of fileArray) {
    if (!(file instanceof File)) continue;

    if (!file.type.startsWith("image/")) continue;

    const safeName = file.name.replace(/\s+/g, "-");
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;

    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(filePath, buffer);

    images.push({
      fileName: file.name,
      filePath: `/uploads/indents/${fileName}`,
      mimeType: file.type,
      size: file.size,
    });
  }

  return images;
};

const parseIndentBody = async (c: Context) => {
  const contentType = c.req.header("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.parseBody({ all: true });
    const body: any = { ...formData };

    if (typeof body.items === "string") {
      body.items = JSON.parse(body.items);
    }

    return {
      body,
      images: await uploadIndentImages(body.images),
    };
  }

  return {
    body: await c.req.json(),
    images: [],
  };
};

const populateIndent = (query: any) => {
  return query
    .populate("requestedBy", "name email mobile")
    .populate("ownerId", "name email mobile")
    .populate("userId", "name email mobile")
    .populate("nodeId", "name type")
    .populate("projectId", "projectName name")
    .populate("towerId", "towerName name")
    .populate("floorId", "floorName name")
    .populate("flatId", "flatName name")
    .populate("items.itemId", "itemName name")
    .populate("items.unitId", "unitName name")
    .populate("approvedBy", "name email mobile");
};

export const createIndent = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const loggedInUserId = getLoggedInUserId(loggedInUser);

    const { body, images } = await parseIndentBody(c);

    const {
      projectId,
      priority = "low",
      estimateDeliveryDate,
      indentFor,
      towerId,
      floorId,
      flatId,
      storageLocation,
      items = [],
      status,
    } = body;

    if (!projectId || !indentFor) {
      return c.json(
        {
          success: false,
          message: "projectId and indentFor are required",
        },
        400
      );
    }

    if (!isValidObjectId(projectId)) {
      return c.json({ success: false, message: "Invalid projectId" }, 400);
    }

    if (!loggedInUserId || !isValidObjectId(loggedInUserId)) {
      return c.json({ success: false, message: "Invalid logged in user" }, 400);
    }

    if (!["low", "medium", "high", "urgent"].includes(priority)) {
      return c.json({ success: false, message: "Invalid priority" }, 400);
    }

    if (!["project", "tower", "floor", "flat"].includes(indentFor)) {
      return c.json({ success: false, message: "Invalid indentFor" }, 400);
    }

    if (towerId && !isValidObjectId(towerId)) {
      return c.json({ success: false, message: "Invalid towerId" }, 400);
    }

    if (floorId && !isValidObjectId(floorId)) {
      return c.json({ success: false, message: "Invalid floorId" }, 400);
    }

    if (flatId && !isValidObjectId(flatId)) {
      return c.json({ success: false, message: "Invalid flatId" }, 400);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return c.json(
        { success: false, message: "At least one item is required" },
        400
      );
    }

    for (const item of items) {
      if (!item.itemId || !item.quantity || !item.unitId) {
        return c.json(
          {
            success: false,
            message: "itemId, quantity and unitId are required in items",
          },
          400
        );
      }

      if (!isValidObjectId(item.itemId)) {
        return c.json({ success: false, message: "Invalid itemId" }, 400);
      }

      if (!isValidObjectId(item.unitId)) {
        return c.json({ success: false, message: "Invalid unitId" }, 400);
      }

      if (Number(item.quantity) <= 0) {
        return c.json(
          { success: false, message: "Quantity must be greater than 0" },
          400
        );
      }
    }

    let finalStatus = "Pending";

    if (canManageIndentStatus(loggedInUser)) {
      if (status && !["Pending", "Approved"].includes(status)) {
        return c.json(
          { success: false, message: "Status can only be Pending or Approved" },
          400
        );
      }

      finalStatus = status || "Pending";
    }

    const indentId = await generateIndentId(loggedInUser.organizationId);

    const indent = await Indent.create({
      organizationId: loggedInUser.organizationId,
      indentId,
      projectId,
      userId: loggedInUserId,
      priority,
      estimateDeliveryDate: estimateDeliveryDate
        ? new Date(estimateDeliveryDate)
        : null,
      indentFor,
      towerId: towerId || null,
      floorId: floorId || null,
      flatId: flatId || null,
      storageLocation: storageLocation || null,
      items,
      images,
      status: finalStatus,
      requestedBy: loggedInUserId,
      ownerId: loggedInUserId,
      nodeId: loggedInUser.primaryNodeId || null,
      approvedBy: finalStatus === "Approved" ? loggedInUserId : null,
      approvedAt: finalStatus === "Approved" ? new Date() : null,
    });

    const populatedIndent = await populateIndent(Indent.findById(indent._id));

    return c.json(
      {
        success: true,
        message: "Indent created successfully",
        data: populatedIndent,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getAllIndents = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const {
      page = "1",
      limit = "10",
      search = "",
      status,
      projectId,
      userId,
      priority,
      indentFor,
    } = c.req.query();

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.max(Number(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const scopeFilter: any = await buildIndentScopeFilter(loggedInUser);

    const filter: any = {
      ...scopeFilter,
      isActive: true,
    };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (indentFor) filter.indentFor = indentFor;

    if (projectId) {
      if (!isValidObjectId(projectId)) {
        return c.json({ success: false, message: "Invalid projectId" }, 400);
      }
      filter.projectId = projectId;
    }

    if (userId) {
      if (!isValidObjectId(userId)) {
        return c.json({ success: false, message: "Invalid userId" }, 400);
      }

      const scope = getUserScope(loggedInUser);

      if (scope === "organization") {
        filter.userId = userId;
      } else if (scope === "team") {
        if (filter.userId?.$in) {
          const allowedIds = filter.userId.$in.map((id: any) => String(id));

          if (!allowedIds.includes(String(userId))) {
            return c.json(
              { success: false, message: "You are not allowed to view this user indents" },
              403
            );
          }

          filter.userId = userId;
        } else if (String(filter.userId) !== String(userId)) {
          return c.json(
            { success: false, message: "You are not allowed to view this user indents" },
            403
          );
        }
      } else {
        if (String(filter.userId) !== String(userId)) {
          return c.json(
            { success: false, message: "You are not allowed to view this user indents" },
            403
          );
        }
      }
    }

    if (search) {
      filter.$or = [
        { indentId: { $regex: search, $options: "i" } },
        { storageLocation: { $regex: search, $options: "i" } },
      ];
    }

    const [indents, total] = await Promise.all([
      populateIndent(
        Indent.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
      ),
      Indent.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      count: indents.length,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: indents,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getIndentById = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid indent id" }, 400);
    }

    const scopeFilter: any = await buildIndentScopeFilter(loggedInUser);

    const indent = await populateIndent(
      Indent.findOne({
        _id: id,
        ...scopeFilter,
        isActive: true,
      })
    );

    if (!indent) {
      return c.json({ success: false, message: "Indent not found" }, 404);
    }

    return c.json({
      success: true,
      data: indent,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateIndent = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");
    const { body, images } = await parseIndentBody(c);

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid indent id" }, 400);
    }

    const scopeFilter: any = await buildIndentScopeFilter(loggedInUser);

    const indent = await Indent.findOne({
      _id: id,
      ...scopeFilter,
      isActive: true,
    });

    if (!indent) {
      return c.json({ success: false, message: "Indent not found" }, 404);
    }

    if (indent.status === "ConvertedToPO") {
      return c.json(
        { success: false, message: "Converted indent cannot be updated" },
        400
      );
    }

    const {
      projectId,
      priority,
      estimateDeliveryDate,
      indentFor,
      towerId,
      floorId,
      flatId,
      storageLocation,
      items,
    } = body;

    if (projectId !== undefined) {
      if (!projectId || !isValidObjectId(projectId)) {
        return c.json({ success: false, message: "Invalid projectId" }, 400);
      }
      indent.projectId = projectId;
    }

    if (priority !== undefined) {
      if (!["low", "medium", "high", "urgent"].includes(priority)) {
        return c.json({ success: false, message: "Invalid priority" }, 400);
      }
      indent.priority = priority;
    }

    if (estimateDeliveryDate !== undefined) {
      indent.estimateDeliveryDate = estimateDeliveryDate
        ? new Date(estimateDeliveryDate)
        : null;
    }

    if (indentFor !== undefined) {
      if (!["project", "tower", "floor", "flat"].includes(indentFor)) {
        return c.json({ success: false, message: "Invalid indentFor" }, 400);
      }
      indent.indentFor = indentFor;
    }

    if (towerId !== undefined) {
      if (towerId && !isValidObjectId(towerId)) {
        return c.json({ success: false, message: "Invalid towerId" }, 400);
      }
      indent.towerId = towerId || null;
    }

    if (floorId !== undefined) {
      if (floorId && !isValidObjectId(floorId)) {
        return c.json({ success: false, message: "Invalid floorId" }, 400);
      }
      indent.floorId = floorId || null;
    }

    if (flatId !== undefined) {
      if (flatId && !isValidObjectId(flatId)) {
        return c.json({ success: false, message: "Invalid flatId" }, 400);
      }
      indent.flatId = flatId || null;
    }

    if (storageLocation !== undefined) {
      indent.storageLocation = storageLocation || null;
    }

    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return c.json(
          { success: false, message: "At least one item is required" },
          400
        );
      }

      for (const item of items) {
        if (!item.itemId || !item.quantity || !item.unitId) {
          return c.json(
            {
              success: false,
              message: "itemId, quantity and unitId are required in items",
            },
            400
          );
        }

        if (!isValidObjectId(item.itemId)) {
          return c.json({ success: false, message: "Invalid itemId" }, 400);
        }

        if (!isValidObjectId(item.unitId)) {
          return c.json({ success: false, message: "Invalid unitId" }, 400);
        }

        if (Number(item.quantity) <= 0) {
          return c.json(
            { success: false, message: "Quantity must be greater than 0" },
            400
          );
        }
      }

      indent.items = items as any;
    }

    if (images.length > 0) {
      indent.images = [...(indent.images || []), ...images] as any;
    }

    await indent.save();

    const updatedIndent = await populateIndent(Indent.findById(indent._id));

    return c.json({
      success: true,
      message: "Indent updated successfully",
      data: updatedIndent,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateIndentStatus = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    const { status, rejectionReason } = body;

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid indent id" }, 400);
    }

    if (!canManageIndentStatus(loggedInUser)) {
      return c.json(
        { success: false, message: "You are not allowed to update status" },
        403
      );
    }

    if (!["Pending", "Approved", "Rejected", "ConvertedToPO"].includes(status)) {
      return c.json({ success: false, message: "Invalid status" }, 400);
    }

    const indent = await Indent.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!indent) {
      return c.json({ success: false, message: "Indent not found" }, 404);
    }

    indent.status = status;

    if (status === "Approved") {
      indent.approvedBy = getLoggedInUserId(loggedInUser);
      indent.approvedAt = new Date();
      indent.rejectionReason = null;
    }

    if (status === "Rejected") {
      indent.approvedBy = null;
      indent.approvedAt = null;
      indent.rejectionReason = rejectionReason || null;
    }

    await indent.save();

    const updatedIndent = await populateIndent(Indent.findById(indent._id));

    return c.json({
      success: true,
      message: "Indent status updated successfully",
      data: updatedIndent,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteIndent = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid indent id" }, 400);
    }

    const scopeFilter: any = await buildIndentScopeFilter(loggedInUser);

    const indent = await Indent.findOne({
      _id: id,
      ...scopeFilter,
      isActive: true,
    });

    if (!indent) {
      return c.json({ success: false, message: "Indent not found" }, 404);
    }

    if (indent.status === "ConvertedToPO") {
      return c.json(
        { success: false, message: "Converted indent cannot be deleted" },
        400
      );
    }

    indent.isActive = false;
    await indent.save();

    return c.json({
      success: true,
      message: "Indent deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};