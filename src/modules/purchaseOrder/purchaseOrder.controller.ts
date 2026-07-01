import type { Context } from "hono";
import mongoose from "mongoose";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PurchaseOrder } from "./purchaseOrder.model";
import { MaterialStock } from "../materialStock/materialStock.model";
import { Indent } from "../IndentRequest/indent.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";
import Asset from "../assets/asset.model";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

const getLoggedInUserId = (user: any) => user?._id || user?.id;

const getUserScope = (user: any) => {
  return user?.scope || user?.role?.scope || user?.roleId?.scope;
};

const getUserRoleName = (user: any) => {
  return user?.roleName || user?.role?.name || user?.roleId?.name || user?.role;
};

const canAccessPurchaseOrder = (user: any) => {
  const scope = String(getUserScope(user) || "").toLowerCase();
  const roleName = String(getUserRoleName(user) || "").toLowerCase();

  return ["organization", "team", "user"].includes(scope) || ["organization", "team", "user"].includes(roleName);
};

const generatePoNo = async (organizationId: string) => {
  const count = await PurchaseOrder.countDocuments({ organizationId });
  return `PO-${String(count + 1).padStart(3, "0")}`;
};

const buildPurchaseOrderScopeFilter = async (loggedInUser: any) => {
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
      filter.createdBy = { $in: scopeFilter.ownerId.$in };
    } else if (scopeFilter.ownerId) {
      filter.createdBy = scopeFilter.ownerId;
    } else {
      filter.createdBy = loggedInUserId;
    }

    return filter;
  }

  filter.createdBy = loggedInUserId;
  return filter;
};

const populatePurchaseOrder = (query: any) => {
  return query
    .populate("indentId", "indentId status")
    .populate("projectId", "projectName name")
    .populate("requesterId", "name email mobile")
    .populate("items.itemId", "itemName name")
    .populate("items.unitId", "unitName name")
    .populate("createdBy", "name email mobile")
    .populate("approvedBy", "name email mobile")
    .populate("approvals.roleId", "name scope")
    .populate("approvals.approvedBy", "name email mobile");
};

const parsePurchaseOrderBody = async (c: Context) => {
  const contentType = c.req.header("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return {
      body: await c.req.json(),
      uploadedImages: [],
    };
  }

  const formData = await c.req.parseBody({ all: true });

  const body: any = {
    indentId: formData.indentId,
    vendorId: formData.vendorId,
    vendorName: formData.vendorName,
    vendorMobile: formData.vendorMobile,
    vendorAddress: formData.vendorAddress,
    items:
      typeof formData.items === "string"
        ? JSON.parse(formData.items)
        : [],
  };

  const files: any[] = [];

  if (Array.isArray(formData.images)) files.push(...formData.images);
  else if (formData.images) files.push(formData.images);

  if (Array.isArray(formData["images[]"])) files.push(...formData["images[]"]);
  else if (formData["images[]"]) files.push(formData["images[]"]);

  const uploadedImages: string[] = [];

  if (files.length > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "purchase-orders");
    await mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      if (!file || typeof file === "string") continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.name}`;
      const filePath = path.join(uploadDir, fileName);

      await writeFile(filePath, buffer);

      uploadedImages.push(`/uploads/purchase-orders/${fileName}`);
    }
  }

  return { body, uploadedImages };
};

const updateIndentConvertedStatus = async (indent: any, organizationId: string) => {
  const existingPurchaseOrders = await PurchaseOrder.find({
    indentId: indent._id,
    organizationId,
    isActive: true,
    status: { $ne: "Cancelled" },
  })
    .select("items.itemId")
    .lean();

  const poItemIds = new Set<string>();

  existingPurchaseOrders.forEach((po: any) => {
    po.items.forEach((item: any) => {
      poItemIds.add(String(item.itemId));
    });
  });

  const allIndentItemIds = indent.items.map((item: any) => String(item.itemId));

  const allItemsConverted = allIndentItemIds.every((itemId: string) =>
    poItemIds.has(itemId)
  );

  indent.status = allItemsConverted ? "ConvertedToPO" : "Approved";
  await indent.save();
};

export const createPurchaseOrderFromIndent = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessPurchaseOrder(loggedInUser)) {
      return c.json(
        { success: false, message: "Only admin or team scope can access purchase order" },
        403
      );
    }

    const loggedInUserId = getLoggedInUserId(loggedInUser);

    const { body, uploadedImages } = await parsePurchaseOrderBody(c);

    const {
      indentId,
      vendorId,
      vendorName,
      vendorMobile,
      vendorAddress,
      items = [],

      purchaseOrderType = "material",
      validFrom,
      validTo,
      expectedDeliveryDate,
      paymentTerm,
      paymentType,
      remark,
      notes,
    } = body;

    if (!indentId || !vendorId) {
      return c.json(
        { success: false, message: "indentId and vendorId are required" },
        400
      );
    }

    if (!isValidObjectId(indentId)) {
      return c.json({ success: false, message: "Invalid indentId" }, 400);
    }

    if (!isValidObjectId(vendorId)) {
      return c.json({ success: false, message: "Invalid vendorId" }, 400);
    }

    if (!["material", "assets"].includes(purchaseOrderType)) {
      return c.json(
        { success: false, message: "purchaseOrderType must be material or assets" },
        400
      );
    }

    const indent = await Indent.findOne({
      _id: indentId,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!indent) {
      return c.json({ success: false, message: "Indent not found" }, 404);
    }

    // ✅ ADD THIS
    if (indent.supplyStatus === "Closed") {
      return c.json(
        {
          success: false,
          message: "Indent already closed. Purchase order cannot be created.",
        },
        400
      );
    }

    if (!["Approved", "ConvertedToPO"].includes(indent.status)) {
      return c.json(
        {
          success: false,
          message: "Only approved indent can be converted to purchase order",
        },
        400
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return c.json(
        { success: false, message: "At least one PO item is required" },
        400
      );
    }

    const indentItemMap: any = {};

    indent.items.forEach((item: any) => {
      indentItemMap[String(item.itemId)] = item;
    });

    const existingPurchaseOrders = await PurchaseOrder.find({
      indentId,
      organizationId: loggedInUser.organizationId,
      isActive: true,
      status: { $ne: "Cancelled" },
    })
      .select("items.itemId")
      .lean();

    const alreadyPoItemIds = new Set<string>();

    existingPurchaseOrders.forEach((po: any) => {
      po.items.forEach((item: any) => {
        alreadyPoItemIds.add(String(item.itemId));
      });
    });

    const requestedItemIds = new Set<string>();
    let totalAmount = 0;

    const poItems = items.map((item: any) => {
      if (!item.itemId || !item.unitId || !item.orderQuantity) {
        throw new Error("itemId, unitId and orderQuantity are required");
      }

      const indentItem = indentItemMap[String(item.itemId)];

      if (!indentItem) {
        throw new Error("Selected item does not belong to this indent");
      }

      // ✅ ADD THIS
      if (indentItem.supplyStatus === "Closed") {
        throw new Error("Selected indent item already closed");
      }

      if (alreadyPoItemIds.has(String(item.itemId))) {
        throw new Error("Purchase order already created for selected item");
      }

      if (requestedItemIds.has(String(item.itemId))) {
        throw new Error("Same item cannot be added multiple times in one request");
      }

      requestedItemIds.add(String(item.itemId));

      const orderQuantity = Number(item.orderQuantity);
      const rate = Number(item.rate || 0);
      const amount = orderQuantity * rate;

      if (orderQuantity <= 0) {
        throw new Error("orderQuantity must be greater than 0");
      }

      totalAmount += amount;

      return {
        itemId: item.itemId,
        unitId: item.unitId,
        indentQuantity: Number(
          item.indentQuantity ||
            indentItem?.quantity ||
            item.orderQuantity ||
            0
        ),
        orderQuantity,
        rate,
        amount,
        receivedQuantity: 0,
        issuedToRequesterQuantity: 0,
        stockQuantity: 0,
      };
    });

    const poNo = await generatePoNo(loggedInUser.organizationId);

    const po = await PurchaseOrder.create({
      organizationId: loggedInUser.organizationId,
      poNo,
      indentId,
      vendorId,
      projectId: indent.projectId,
      requesterId: indent.userId,

      purchaseOrderType,

      vendorName,
      vendorMobile: vendorMobile || null,
      vendorAddress: vendorAddress || null,

      validFrom: validFrom || null,
      validTo: validTo || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      paymentTerm: paymentTerm || null,
      paymentType: paymentType || null,
      remark: remark || null,
      notes: notes || null,

      images: uploadedImages,
      attachedFiles: uploadedImages,

      items: poItems,
      totalAmount,

      status: "Approved",
      approvalFlowId: null,
      currentApprovalLevel: 0,
      approvals: [],

      createdBy: loggedInUserId,
      approvedBy: loggedInUserId,
      approvedAt: new Date(),
    });

    await updateIndentConvertedStatus(indent, loggedInUser.organizationId);

    const populatedPo = await populatePurchaseOrder(PurchaseOrder.findById(po._id));

    return c.json(
      {
        success: true,
        message: "Purchase order created successfully",
        data: populatedPo,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const approvePurchaseOrder = async (c: Context) => {
  return c.json(
    {
      success: false,
      message:
        "Purchase order approval flow removed. Create a gate pass and approve it to post material or assets into stock.",
    },
    400
  );
};

export const markPurchaseOrderOrdered = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessPurchaseOrder(loggedInUser)) {
      return c.json(
        { success: false, message: "Only admin or team scope can access purchase order" },
        403
      );
    }

    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json(
        { success: false, message: "Invalid purchase order id" },
        400
      );
    }

    const scopeFilter = await buildPurchaseOrderScopeFilter(loggedInUser);

    const po = await PurchaseOrder.findOne({
      _id: id,
      ...scopeFilter,
      isActive: true,
    });

    if (!po) {
      return c.json({ success: false, message: "Purchase order not found" }, 404);
    }

    if (po.status !== "Approved") {
      return c.json(
        { success: false, message: "Only approved purchase order can be ordered" },
        400
      );
    }

    po.status = "Ordered";
    await po.save();

    const populatedPo = await populatePurchaseOrder(PurchaseOrder.findById(po._id));

    return c.json({
      success: true,
      message: "Purchase order marked as ordered successfully",
      data: populatedPo,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const receivePurchaseOrderMaterial = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessPurchaseOrder(loggedInUser)) {
      return c.json(
        { success: false, message: "Only admin or team scope can access purchase order" },
        403
      );
    }

    const id = c.req.param("id");
    const body = await c.req.json();

    const { items = [] } = body;

    if (!isValidObjectId(id)) {
      return c.json(
        { success: false, message: "Invalid purchase order id" },
        400
      );
    }

    const scopeFilter = await buildPurchaseOrderScopeFilter(loggedInUser);

    const po = await PurchaseOrder.findOne({
      _id: id,
      ...scopeFilter,
      isActive: true,
    });

    if (!po) {
      return c.json({ success: false, message: "Purchase order not found" }, 404);
    }

    if (!["material", "assets"].includes(po.purchaseOrderType)) {
      return c.json(
        { success: false, message: "Invalid purchase order type" },
        400
      );
    }

    if (!["Approved", "Ordered", "PartiallyReceived"].includes(po.status)) {
      return c.json(
        { success: false, message: "Purchase order cannot be received in current status" },
        400
      );
    }

    const now = new Date();

    if (po.expectedDeliveryDate && now > new Date(po.expectedDeliveryDate)) {
      return c.json(
        { success: false, message: "Purchase order cannot be received after expected delivery date" },
        400
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return c.json(
        { success: false, message: "At least one received item is required" },
        400
      );
    }

    for (const receivedItem of items) {
      const poItem: any = po.items.find(
        (item: any) => String(item.itemId) === String(receivedItem.itemId)
      );

      if (!poItem) {
        return c.json({ success: false, message: "PO item not found" }, 400);
      }

      const receivedQty = Number(receivedItem.receivedQuantity || 0);

      if (receivedQty <= 0) {
        return c.json(
          { success: false, message: "receivedQuantity must be greater than 0" },
          400
        );
      }

      const oldReceivedQty = Number(poItem.receivedQuantity || 0);
      const newReceivedQty = oldReceivedQty + receivedQty;

      if (newReceivedQty > Number(poItem.orderQuantity)) {
        return c.json(
          {
            success: false,
            message: "Received quantity cannot be greater than order quantity",
          },
          400
        );
      }

      poItem.receivedQuantity = newReceivedQty;

      if (po.purchaseOrderType === "material") {
        let stock = await MaterialStock.findOne({
          organizationId: po.organizationId,
          projectId: po.projectId,
          indentId: po.indentId,
          purchaseOrderId: po._id,
          requesterId: po.requesterId,
          itemId: poItem.itemId,
          unitId: poItem.unitId,
        });

        if (stock) {
          stock.receivedQuantity += receivedQty;
          stock.availableQuantity += receivedQty;
          stock.purchasedQuantity = poItem.orderQuantity;
          stock.status = stock.availableQuantity > 0 ? "Available" : "Issued";
          await stock.save();
        } else {
          await MaterialStock.create({
            organizationId: po.organizationId,
            projectId: po.projectId,
            indentId: po.indentId,
            purchaseOrderId: po._id,
            requesterId: po.requesterId,
            itemId: poItem.itemId,
            unitId: poItem.unitId,
            purchasedQuantity: poItem.orderQuantity,
            receivedQuantity: receivedQty,
            issuedQuantity: 0,
            availableQuantity: receivedQty,
            status: "Available",
          });
        }
      }

      if (po.purchaseOrderType === "assets") {
        const itemName =
          receivedItem.name ||
          receivedItem.assetName ||
          `Asset-${String(poItem.itemId)}`;

        for (let i = 0; i < receivedQty; i++) {
          await Asset.create({
            name: itemName,
            type: receivedItem.type || "assets",
            serialNumber: receivedItem.serialNumbers?.[i] || null,
            issuedDate: new Date(),
            status: "Available",
            maintenanceDueDate: receivedItem.maintenanceDueDate || null,
            extraNote: receivedItem.extraNote || null,
          });
        }
      }
    }

    const allReceived = po.items.every(
      (item: any) =>
        Number(item.receivedQuantity || 0) >= Number(item.orderQuantity || 0)
    );

    po.status = allReceived ? "Received" : "PartiallyReceived";
    await po.save();

    const populatedPo = await populatePurchaseOrder(PurchaseOrder.findById(po._id));

    return c.json({
      success: true,
      message:
        po.purchaseOrderType === "assets"
          ? "Purchase order assets received and added successfully"
          : "Purchase order material received successfully",
      data: populatedPo,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const issueMaterialToRequester = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessPurchaseOrder(loggedInUser)) {
      return c.json(
        { success: false, message: "Only admin or team scope can supply material" },
        403
      );
    }

    const id = c.req.param("id");
    const { items = [] } = await c.req.json();

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid purchase order id" }, 400);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, message: "At least one supply item is required" }, 400);
    }

    const po: any = await PurchaseOrder.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!po) {
      return c.json({ success: false, message: "Purchase order not found" }, 404);
    }

    if (po.purchaseOrderType !== "material") {
      return c.json({ success: false, message: "Only material PO can be supplied" }, 400);
    }

    if (!["Received", "PartiallyReceived"].includes(po.status)) {
      return c.json({ success: false, message: "Only received material can be supplied" }, 400);
    }

    const indent: any = await Indent.findOne({
      _id: po.indentId,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!indent) {
      return c.json({ success: false, message: "Indent not found" }, 404);
    }

    if (indent.supplyStatus === "Closed") {
      return c.json({ success: false, message: "Indent already closed. Supply not allowed." }, 400);
    }

    for (const supplyItem of items) {
      const itemId = supplyItem.itemId;
      const supplyQty = Number(supplyItem.supplyQuantity || 0);

      if (!itemId || supplyQty <= 0) {
        return c.json({ success: false, message: "itemId and valid supplyQuantity are required" }, 400);
      }

      const poItem: any = po.items.find(
        (x: any) => String(x.itemId) === String(itemId)
      );

      if (!poItem) {
        return c.json({ success: false, message: "Item not found in PO" }, 400);
      }

      const stock: any = await MaterialStock.findOne({
        organizationId: po.organizationId,
        projectId: po.projectId,
        indentId: po.indentId,
        purchaseOrderId: po._id,
        requesterId: po.requesterId,
        itemId: poItem.itemId,
        unitId: poItem.unitId,
      });

      if (!stock || Number(stock.availableQuantity || 0) < supplyQty) {
        return c.json({ success: false, message: "Not enough available stock" }, 400);
      }

      const indentItem: any = indent.items.find(
        (x: any) => String(x.itemId) === String(itemId)
      );

      if (!indentItem) {
        return c.json({ success: false, message: "Item not found in indent" }, 400);
      }

      const requestedQty = Number(indentItem.quantity || 0);
      const alreadySupplied = Number(indentItem.suppliedQuantity || 0);
      const remainingQty = requestedQty - alreadySupplied;

      if (supplyQty > remainingQty) {
        return c.json({
          success: false,
          message: "Supply quantity cannot be greater than indent remaining quantity",
        }, 400);
      }

      indentItem.suppliedQuantity = alreadySupplied + supplyQty;
      indentItem.remainingQuantity = requestedQty - indentItem.suppliedQuantity;
      indentItem.supplyStatus = indentItem.remainingQuantity <= 0 ? "Closed" : "Open";

      poItem.issuedToRequesterQuantity =
        Number(poItem.issuedToRequesterQuantity || 0) + supplyQty;

      stock.issuedQuantity = Number(stock.issuedQuantity || 0) + supplyQty;
      stock.availableQuantity = Number(stock.availableQuantity || 0) - supplyQty;
      stock.status = stock.availableQuantity > 0 ? "Available" : "Issued";

      await stock.save();
    }

    const allClosed = indent.items.every(
      (x: any) => Number(x.remainingQuantity ?? x.quantity ?? 0) <= 0 || x.supplyStatus === "Closed"
    );

    indent.supplyStatus = allClosed ? "Closed" : "PartiallySupplied";
    await indent.save();

    const allPoStockIssued = po.items.every(
      (x: any) =>
        Number(x.issuedToRequesterQuantity || 0) >= Number(x.indentQuantity || 0)
    );

    if (allPoStockIssued) {
      po.status = "Issued";
    }

    await po.save();

    const populatedPo = await populatePurchaseOrder(PurchaseOrder.findById(po._id));

    return c.json({
      success: true,
      message: allClosed
        ? "Material supplied successfully. Indent closed."
        : "Material supplied successfully. Indent still open.",
      data: populatedPo,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getAllPurchaseOrders = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessPurchaseOrder(loggedInUser)) {
      return c.json(
        { success: false, message: "Only admin or team scope can access purchase order" },
        403
      );
    }

    const {
      page = "1",
      limit = "10",
      search = "",
      status,
      projectId,
      indentId,
      vendorId,
      itemId,
      purchaseOrderType,
    } = c.req.query();

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.max(Number(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const scopeFilter = await buildPurchaseOrderScopeFilter(loggedInUser);

    const filter: any = {
      ...scopeFilter,
      isActive: true,
    };

    if (status) filter.status = status;

    if (purchaseOrderType) {
      if (!["material", "assets"].includes(purchaseOrderType)) {
        return c.json(
          { success: false, message: "purchaseOrderType must be material or assets" },
          400
        );
      }

      filter.purchaseOrderType = purchaseOrderType;
    }

    if (projectId) {
      if (!isValidObjectId(projectId)) {
        return c.json({ success: false, message: "Invalid projectId" }, 400);
      }
      filter.projectId = projectId;
    }

    if (indentId) {
      if (!isValidObjectId(indentId)) {
        return c.json({ success: false, message: "Invalid indentId" }, 400);
      }
      filter.indentId = indentId;
    }

    if (vendorId) {
      if (!isValidObjectId(vendorId)) {
        return c.json({ success: false, message: "Invalid vendorId" }, 400);
      }
      filter.vendorId = vendorId;
    }

    if (itemId) {
      if (!isValidObjectId(itemId)) {
        return c.json({ success: false, message: "Invalid itemId" }, 400);
      }
      filter["items.itemId"] = itemId;
    }

    if (search) {
      filter.$or = [
        { poNo: { $regex: search, $options: "i" } },
        { vendorName: { $regex: search, $options: "i" } },
        { vendorMobile: { $regex: search, $options: "i" } },
        { paymentTerm: { $regex: search, $options: "i" } },
        { paymentType: { $regex: search, $options: "i" } },
        { remark: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    const [orders, total] = await Promise.all([
      populatePurchaseOrder(
        PurchaseOrder.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
      ),
      PurchaseOrder.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      count: orders.length,
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      data: orders,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getPurchaseOrderById = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessPurchaseOrder(loggedInUser)) {
      return c.json(
        { success: false, message: "Only admin or team scope can access purchase order" },
        403
      );
    }

    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json(
        { success: false, message: "Invalid purchase order id" },
        400
      );
    }

    const scopeFilter = await buildPurchaseOrderScopeFilter(loggedInUser);

    const po = await populatePurchaseOrder(
      PurchaseOrder.findOne({
        _id: id,
        ...scopeFilter,
        isActive: true,
      })
    );

    if (!po) {
      return c.json({ success: false, message: "Purchase order not found" }, 404);
    }

    return c.json({
      success: true,
      data: po,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const cancelPurchaseOrder = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessPurchaseOrder(loggedInUser)) {
      return c.json(
        { success: false, message: "Only admin or team scope can access purchase order" },
        403
      );
    }

    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json(
        { success: false, message: "Invalid purchase order id" },
        400
      );
    }

    const scopeFilter = await buildPurchaseOrderScopeFilter(loggedInUser);

    const po = await PurchaseOrder.findOne({
      _id: id,
      ...scopeFilter,
      isActive: true,
    });

    if (!po) {
      return c.json({ success: false, message: "Purchase order not found" }, 404);
    }

    if (["Received", "PartiallyReceived", "Issued"].includes(po.status)) {
      return c.json(
        { success: false, message: "Received or issued PO cannot be cancelled" },
        400
      );
    }

    po.status = "Cancelled";
    await po.save();

    const indent = await Indent.findOne({
      _id: po.indentId,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (indent) {
      await updateIndentConvertedStatus(indent, loggedInUser.organizationId);
    }

    const populatedPo = await populatePurchaseOrder(PurchaseOrder.findById(po._id));

    return c.json({
      success: true,
      message: "Purchase order cancelled successfully",
      data: populatedPo,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};