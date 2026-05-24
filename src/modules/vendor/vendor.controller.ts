import type { Context } from "hono";
import mongoose from "mongoose";
import { Vendor } from "./vendor.model";

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

const getAccessQuery = (user: any) => {
  const query: any = {
    organizationId: user.organizationId,
  };

  // CRM hierarchy logic
  // admin / owner ko full org access
  if (!["admin", "owner", "superAdmin"].includes(user.role)) {
    query.ownerId = user.id || user._id;
  }

  return query;
};

const formatVendor = (vendor: any) => {
  const item: any = vendor.itemId;

  return {
    id: vendor._id,
    vendorCode: vendor.vendorCode,
    name: vendor.name,
    companyName: vendor.companyName,
    address: vendor.address,
    city: vendor.city,
    state: vendor.state,
    pincode: vendor.pincode,
    gstNumber: vendor.gstNumber,
    panNumber: vendor.panNumber,
    contactPerson: vendor.contactPerson,
    contactNumber: vendor.contactNumber,
    alternateNumber: vendor.alternateNumber,
    email: vendor.email,
    bankName: vendor.bankName,
    accountNumber: vendor.accountNumber,
    ifscCode: vendor.ifscCode,
    status: vendor.status,
    itemId: item?._id || vendor.itemId,
    itemName: item?.name || item?.itemName || "",
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
};

export const createVendor = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.vendorCode || !body.name || !body.itemId) {
      return c.json(
        {
          success: false,
          message: "vendorCode, name and itemId are required",
        },
        400
      );
    }

    if (!isValidObjectId(body.itemId)) {
      return c.json(
        {
          success: false,
          message: "Invalid itemId",
        },
        400
      );
    }

    const exists = await Vendor.findOne({
      organizationId: user.organizationId,
      vendorCode: body.vendorCode,
    });

    if (exists) {
      return c.json(
        {
          success: false,
          message: "Vendor code already exists",
        },
        409
      );
    }

    const vendor = await Vendor.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: body.ownerId || user.id || user._id,
      createdBy: user.id || user._id,
    });

    const populatedVendor = await Vendor.findById(vendor._id).populate("itemId");

    return c.json(
      {
        success: true,
        message: "Vendor created successfully",
        data: formatVendor(populatedVendor),
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getVendors = async (c: Context) => {
  try {
    const user = c.get("user");

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const itemId = c.req.query("itemId");
    const status = c.req.query("status");

    const skip = (page - 1) * limit;

    const query: any = getAccessQuery(user);

    if (search) {
      query.$or = [
        { vendorCode: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
        { panNumber: { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
        { contactNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }

    if (itemId) {
      if (!isValidObjectId(itemId)) {
        return c.json({ success: false, message: "Invalid itemId" }, 400);
      }
      query.itemId = itemId;
    }

    if (status) {
      query.status = status;
    }

    const total = await Vendor.countDocuments(query);

    const vendors = await Vendor.find(query)
      .populate("itemId")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      data: vendors.map(formatVendor),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getVendorById = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!id) {
      return c.json(
        {
          success: false,
          message: "Vendor id is required",
        },
        400
      );
    }
    if (!isValidObjectId(id)) {
        return c.json(
          {
            success: false,
            message: "Invalid vendor id",
          },
          400
        );
      }

    const vendor = await Vendor.findOne({
      _id: id,
      ...getAccessQuery(user),
    }).populate("itemId");

    if (!vendor) {
      return c.json({ success: false, message: "Vendor not found" }, 404);
    }

    return c.json({
      success: true,
      data: formatVendor(vendor),
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateVendor = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
        return c.json(
          {
            success: false,
            message: "Vendor id is required",
          },
          400
        );
      }

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid vendor id" }, 400);
    }

    if (body.itemId && !isValidObjectId(body.itemId)) {
      return c.json({ success: false, message: "Invalid itemId" }, 400);
    }

    if (body.vendorCode) {
      const exists = await Vendor.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        vendorCode: body.vendorCode,
      });

      if (exists) {
        return c.json(
          {
            success: false,
            message: "Vendor code already exists",
          },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.createdBy;
    delete body.ownerId;

    const vendor = await Vendor.findOneAndUpdate(
      {
        _id: id,
        ...getAccessQuery(user),
      },
      body,
      {
        new: true,
        runValidators: true,
      }
    ).populate("itemId");

    if (!vendor) {
      return c.json({ success: false, message: "Vendor not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Vendor updated successfully",
      data: formatVendor(vendor),
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteVendor = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!id) {
        return c.json(
          {
            success: false,
            message: "Vendor id is required",
          },
          400
        );
      }

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid vendor id" }, 400);
    }

    const vendor = await Vendor.findOneAndDelete({
      _id: id,
      ...getAccessQuery(user),
    });

    if (!vendor) {
      return c.json({ success: false, message: "Vendor not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Vendor deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};