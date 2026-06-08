import type { Context } from "hono";
import { MaterialIssue } from "../materialIssue/materialIssue.model";
import { MaterialStock } from "../materialStock/materialStock.model";
import { isValidObjectId } from "mongoose";


const getLoggedInUserId = (user: any) => user?._id || user?.id;


export const issueMaterialFromStock = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const loggedInUserId = getLoggedInUserId(loggedInUser);

    const body = await c.req.json();
    const { stockId, issueQuantity, note } = body;

    if (!stockId || !issueQuantity) {
      return c.json(
        { success: false, message: "stockId and issueQuantity are required" },
        400
      );
    }

    if (!isValidObjectId(stockId)) {
      return c.json({ success: false, message: "Invalid stockId" }, 400);
    }

    const stock = await MaterialStock.findOne({
      _id: stockId,
      organizationId: loggedInUser.organizationId,
    });

    if (!stock) {
      return c.json({ success: false, message: "Stock not found" }, 404);
    }

    const qty = Number(issueQuantity);

    if (qty <= 0) {
      return c.json(
        { success: false, message: "issueQuantity must be greater than 0" },
        400
      );
    }

    if (qty > Number(stock.availableQuantity || 0)) {
      return c.json(
        {
          success: false,
          message: "Issue quantity cannot be greater than available stock",
        },
        400
      );
    }

    stock.issuedQuantity += qty;
    stock.availableQuantity -= qty;

    if (stock.availableQuantity === 0) {
      stock.status = "Issued";
    } else {
      stock.status = "PartiallyIssued";
    }

    await stock.save();

    await MaterialIssue.create({
      organizationId: stock.organizationId,
      stockId: stock._id,
      indentId: stock.indentId,
      purchaseOrderId: stock.purchaseOrderId,
      requesterId: stock.requesterId,
      projectId: stock.projectId,
      itemId: stock.itemId,
      unitId: stock.unitId,
      issueQuantity: qty,
      issuedBy: loggedInUserId,
      note: note || null,
    });

    const populatedStock = await MaterialStock.findById(stock._id)
      .populate("indentId", "indentId status")
      .populate("purchaseOrderId", "poNo status")
      .populate("requesterId", "name email mobile")
      .populate("projectId", "projectName name")
      .populate("itemId", "itemName name")
      .populate("unitId", "unitName name");

    return c.json({
      success: true,
      message: "Material issued successfully",
      data: populatedStock,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};


export const getAllMaterialStock = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const {
      page = "1",
      limit = "10",
      projectId,
      requesterId,
      indentId,
      itemId,
      status,
      search = "",
    } = c.req.query();

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.max(Number(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const filter: any = {
      organizationId: loggedInUser.organizationId,
    };

    if (projectId) filter.projectId = projectId;
    if (requesterId) filter.requesterId = requesterId;
    if (indentId) filter.indentId = indentId;
    if (itemId) filter.itemId = itemId;
    if (status) filter.status = status;

    const [stocks, total] = await Promise.all([
      MaterialStock.find(filter)
        .populate("indentId", "indentId status")
        .populate("purchaseOrderId", "poNo status")
        .populate("requesterId", "name email mobile")
        .populate("projectId", "projectName name")
        .populate("itemId", "itemName name")
        .populate("unitId", "unitName name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      MaterialStock.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      count: stocks.length,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: stocks,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};



export const getMaterialIssueHistory = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    const {
      page = "1",
      limit = "10",
      requesterId,
      indentId,
      stockId,
      itemId,
      projectId,
    } = c.req.query();

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.max(Number(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const filter: any = {
      organizationId: loggedInUser.organizationId,
    };

    if (requesterId) filter.requesterId = requesterId;
    if (indentId) filter.indentId = indentId;
    if (stockId) filter.stockId = stockId;
    if (itemId) filter.itemId = itemId;
    if (projectId) filter.projectId = projectId;

    const [issues, total] = await Promise.all([
      MaterialIssue.find(filter)
        .populate("stockId")
        .populate("indentId", "indentId status")
        .populate("purchaseOrderId", "poNo status")
        .populate("requesterId", "name email mobile")
        .populate("projectId", "projectName name")
        .populate("itemId", "itemName name")
        .populate("unitId", "unitName name")
        .populate("issuedBy", "name email mobile")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      MaterialIssue.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      count: issues.length,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: issues,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};