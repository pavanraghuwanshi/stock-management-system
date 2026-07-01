import type { Context } from "hono";
import mongoose from "mongoose";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { GatePass } from "./gatePass.model";
import { PurchaseOrder } from "../purchaseOrder/purchaseOrder.model";
import { MaterialStock } from "../materialStock/materialStock.model";
import Asset from "../assets/asset.model";
import { Indent } from "../IndentRequest/indent.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);
const getLoggedInUserId = (user: any) => user?._id || user?.id;

const getUserScope = (user: any) => {
  return user?.scope || user?.role?.scope || user?.roleId?.scope;
};

const getUserRoleName = (user: any) => {
  return user?.roleName || user?.role?.name || user?.roleId?.name || user?.role;
};

const canAccessGatePass = (user: any) => {
  const scope = String(getUserScope(user) || "").toLowerCase();
  const roleName = String(getUserRoleName(user) || "").toLowerCase();

  return ["organization", "team", "user"].includes(scope) || ["organization", "team", "user"].includes(roleName);
};

const buildGatePassScopeFilter = async (loggedInUser: any) => {
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

const generateGatePassNo = async (organizationId: string) => {
  const count = await GatePass.countDocuments({ organizationId });
  return `GP-${String(count + 1).padStart(3, "0")}`;
};

const parseGatePassBody = async (c: Context) => {
  const contentType = c.req.header("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return {
      body: await c.req.json(),
      uploadedImages: [],
    };
  }

  const formData = await c.req.parseBody({ all: true });

  const body: any = {
    purchaseOrderId: formData.purchaseOrderId,
    vehicleNumber: formData.vehicleNumber,
    driverName: formData.driverName,
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
    const uploadDir = path.join(process.cwd(), "uploads", "gate-passes");
    await mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      if (!file || typeof file === "string") continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.name}`;
      const filePath = path.join(uploadDir, fileName);

      await writeFile(filePath, buffer);
      uploadedImages.push(`/uploads/gate-passes/${fileName}`);
    }
  }

  return { body, uploadedImages };
};

const parseGatePassVerificationBody = async (c: Context) => {
  const contentType = c.req.header("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    const body = await c.req.json();
    return {
      body,
      uploadedImages: [],
    };
  }

  const formData = await c.req.parseBody({ all: true });
  const body: any = {
    verificationNote: formData.verificationNote || formData.note || null,
  };

  const files: any[] = [];

  if (Array.isArray(formData.images)) files.push(...formData.images);
  else if (formData.images) files.push(formData.images);

  if (Array.isArray(formData["images[]"])) files.push(...formData["images[]"]);
  else if (formData["images[]"]) files.push(formData["images[]"]);

  const uploadedImages: string[] = [];

  if (files.length > 0) {
    const uploadDir = path.join(process.cwd(), "uploads", "gate-passes");
    await mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      if (!file || typeof file === "string") continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.name}`;
      const filePath = path.join(uploadDir, fileName);

      await writeFile(filePath, buffer);
      uploadedImages.push(`/uploads/gate-passes/${fileName}`);
    }
  }

  return { body, uploadedImages };
};

export const createGatePass = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessGatePass(loggedInUser)) {
      return c.json({ success: false, message: "Only admin or team scope can create gate pass" }, 403);
    }

    const { body, uploadedImages } = await parseGatePassBody(c);
    const { purchaseOrderId, vehicleNumber, driverName, items = [] } = body;

    if (!purchaseOrderId || !isValidObjectId(purchaseOrderId)) {
      return c.json({ success: false, message: "Valid purchaseOrderId is required" }, 400);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, message: "At least one item is required" }, 400);
    }

    const po: any = await PurchaseOrder.findOne({
      _id: purchaseOrderId,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!po) {
      return c.json({ success: false, message: "Purchase order not found" }, 404);
    }

    if (["Cancelled", "Issued", "Received"].includes(po.status)) {
      return c.json({ success: false, message: "Gate pass cannot be created for this PO status" }, 400);
    }

    const gateItems = [];

    for (const item of items) {
      if (!item.itemId || !item.receivedQuantity) {
        return c.json({ success: false, message: "itemId and receivedQuantity are required" }, 400);
      }

      const poItem: any = po.items.find(
        (x: any) => String(x.itemId) === String(item.itemId)
      );

      if (!poItem) {
        return c.json({ success: false, message: "Item does not belong to this PO" }, 400);
      }

      const receivedQuantity = Number(item.receivedQuantity);

      if (receivedQuantity <= 0) {
        return c.json({ success: false, message: "receivedQuantity must be greater than 0" }, 400);
      }

      const remainingQty =
        Number(poItem.orderQuantity || 0) - Number(poItem.receivedQuantity || 0);

      if (receivedQuantity > remainingQty) {
        return c.json({
          success: false,
          message: "Gate pass quantity cannot be greater than PO remaining quantity",
        }, 400);
      }

      gateItems.push({
        itemId: poItem.itemId,
        unitId: poItem.unitId,
        receivedQuantity,
        approvedQuantity: 0,
        assetName: item.assetName,
        assetType: item.assetType,
        serialNumbers: item.serialNumbers || [],
        maintenanceDueDate: item.maintenanceDueDate || null,
        extraNote: item.extraNote || null,
      });
    }

    const gatePassNo = await generateGatePassNo(loggedInUser.organizationId);

    const gatePass = await GatePass.create({
      organizationId: loggedInUser.organizationId,
      purchaseOrderId: po._id,
      indentId: po.indentId,
      projectId: po.projectId,
      requesterId: po.requesterId,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      vehicleNumber,
      driverName,
      gatePassNo,
      images: uploadedImages,
      items: gateItems,
      status: "PendingApproval",
      createdBy: getLoggedInUserId(loggedInUser),
    });

    return c.json({
      success: true,
      message: "Gate pass created successfully. Waiting for admin approval.",
      data: gatePass,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const verifyGatePassAtLocation = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessGatePass(loggedInUser)) {
      return c.json({ success: false, message: "Only admin or team scope can verify gate pass" }, 403);
    }

    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid gate pass id" }, 400);
    }

    const { body, uploadedImages } = await parseGatePassVerificationBody(c);
    const verificationNote = String(body?.verificationNote || "").trim();

    const gatePass: any = await GatePass.findOne({
      _id: id,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!gatePass) {
      return c.json({ success: false, message: "Gate pass not found" }, 404);
    }

    if (gatePass.status !== "PendingApproval") {
      return c.json({ success: false, message: "Only pending gate pass can be verified" }, 400);
    }

    if (!uploadedImages.length && !verificationNote) {
      return c.json({ success: false, message: "Provide at least one photo or verification note" }, 400);
    }

    if (uploadedImages.length > 0) {
      gatePass.images = [...(gatePass.images || []), ...uploadedImages];
    }

    if (verificationNote) {
      gatePass.verificationNote = verificationNote;
    }

    gatePass.isVerifiedAtLocation = true;
    gatePass.verifiedBy = getLoggedInUserId(loggedInUser);
    gatePass.verifiedAt = new Date();
    await gatePass.save();

    return c.json({
      success: true,
      message: "Gate pass verified at location successfully",
      data: gatePass,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const approveGatePass = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");

    if (!canAccessGatePass(loggedInUser)) {
      return c.json({ success: false, message: "Only admin or team scope can approve gate pass" }, 403);
    }

    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid gate pass id" }, 400);
    }

    const scopeFilter = await buildGatePassScopeFilter(loggedInUser);

    const gatePass: any = await GatePass.findOne({
      _id: id,
      ...scopeFilter,
      isActive: true,
    });

    if (!gatePass) {
      return c.json({ success: false, message: "Gate pass not found" }, 404);
    }

    if (gatePass.status !== "PendingApproval") {
      return c.json({ success: false, message: "Only pending gate pass can be approved" }, 400);
    }

    if (gatePass.isStockPosted) {
      return c.json({ success: false, message: "Gate pass already posted to stock/assets" }, 400);
    }

    if (!gatePass.isVerifiedAtLocation) {
      return c.json({ success: false, message: "Gate pass must be verified at location before approval" }, 400);
    }

    const po: any = await PurchaseOrder.findOne({
      _id: gatePass.purchaseOrderId,
      organizationId: loggedInUser.organizationId,
      isActive: true,
    });

    if (!po) {
      return c.json({ success: false, message: "Purchase order not found" }, 404);
    }

    for (const gateItem of gatePass.items) {
      const poItem: any = po.items.find(
        (x: any) => String(x.itemId) === String(gateItem.itemId)
      );

      if (!poItem) {
        return c.json({ success: false, message: "PO item not found" }, 400);
      }

      const approveQty = Number(gateItem.receivedQuantity || 0);
      const remainingQty =
        Number(poItem.orderQuantity || 0) - Number(poItem.receivedQuantity || 0);

      if (approveQty > remainingQty) {
        return c.json({
          success: false,
          message: "Approved quantity cannot be greater than PO remaining quantity",
        }, 400);
      }

      gateItem.approvedQuantity = approveQty;
      poItem.receivedQuantity = Number(poItem.receivedQuantity || 0) + approveQty;

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
          stock.receivedQuantity += approveQty;
          stock.availableQuantity += approveQty;
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
            receivedQuantity: approveQty,
            issuedQuantity: 0,
            availableQuantity: approveQty,
            status: "Available",
          });
        }
      }

      if (po.purchaseOrderType === "assets") {
        for (let i = 0; i < approveQty; i++) {
          await Asset.create({
            name: gateItem.assetName || `Asset-${String(poItem.itemId)}`,
            type: gateItem.assetType || "assets",
            serialNumber: gateItem.serialNumbers?.[i] || null,
            issuedDate: new Date(),
            status: "Available",
            maintenanceDueDate: gateItem.maintenanceDueDate || null,
            extraNote: gateItem.extraNote || null,
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

    gatePass.status = "Approved";
    gatePass.isStockPosted = true;
    gatePass.approvedBy = getLoggedInUserId(loggedInUser);
    gatePass.approvedAt = new Date();
    await gatePass.save();

    return c.json({
      success: true,
      message: po.purchaseOrderType === "assets"
        ? "Gate pass approved and assets added successfully"
        : "Gate pass approved and material added to stock successfully",
      data: gatePass,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const rejectGatePass = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const id = c.req.param("id");
    const { reason } = await c.req.json();

    if (!canAccessGatePass(loggedInUser)) {
      return c.json({ success: false, message: "Only admin or team scope can reject gate pass" }, 403);
    }

    const scopeFilter = await buildGatePassScopeFilter(loggedInUser);

    const gatePass = await GatePass.findOne({
      _id: id,
      ...scopeFilter,
      isActive: true,
      status: "PendingApproval",
    });

    if (!gatePass) {
      return c.json({ success: false, message: "Pending gate pass not found" }, 404);
    }

    gatePass.status = "Rejected";
    gatePass.rejectedReason = reason || "";
    await gatePass.save();

    return c.json({
      success: true,
      message: "Gate pass rejected successfully",
      data: gatePass,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getAllGatePasses = async (c: Context) => {
  try {
    const loggedInUser = c.get("user");
    const { page = "1", limit = "10", status, purchaseOrderId, indentId } = c.req.query();

    const filter: any = {
      ...(await buildGatePassScopeFilter(loggedInUser)),
      isActive: true,
    };

    if (status) filter.status = status;
    if (purchaseOrderId) filter.purchaseOrderId = purchaseOrderId;
    if (indentId) filter.indentId = indentId;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.max(Number(limit) || 10, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const [data, total] = await Promise.all([
      GatePass.find(filter)
        .populate("purchaseOrderId", "poNo status purchaseOrderType")
        .populate("indentId", "indentId status supplyStatus")
        .populate("items.itemId", "itemName name")
        .populate("items.unitId", "unitName name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      GatePass.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      total,
      count: data.length,
      page: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      data,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};