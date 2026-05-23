import type { Context } from "hono";
import mongoose from "mongoose";
import { Organization } from "./organization.model";




const isValidObjectId = (id: any) => mongoose.Types.ObjectId.isValid(id);

export const createOrganization = async (c: Context) => {
  try {
    const body = await c.req.json();

    const { name, industryType, email, mobile, address } = body;

    if (!name) {
      return c.json({ success: false, message: "Organization name is required" }, 400);
    }

    const exists = await Organization.findOne({ name: name.trim() });

    if (exists) {
      return c.json({ success: false, message: "Organization already exists" }, 409);
    }

    const organization = await Organization.create({
      name: name.trim(),
      industryType: industryType || null,
      email: email || null,
      mobile: mobile || null,
      address: address || null,
    });

    return c.json({
      success: true,
      message: "Organization created successfully",
      data: organization,
    }, 201);
  } catch (error: any) {
    if (error.code === 11000) {
      return c.json({ success: false, message: "Organization already exists" }, 409);
    }

    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getAllOrganizations = async (c: Context) => {
  try {
    const organizations = await Organization.find()
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      count: organizations.length,
      data: organizations,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getOrganizationById = async (c: Context) => {
  try {
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid organization id" }, 400);
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return c.json({ success: false, message: "Organization not found" }, 404);
    }

    return c.json({
      success: true,
      data: organization,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateOrganization = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid organization id" }, 400);
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return c.json({ success: false, message: "Organization not found" }, 404);
    }

    if (body.name !== undefined) {
      if (!body.name) {
        return c.json({ success: false, message: "Organization name cannot be empty" }, 400);
      }

      const exists = await Organization.findOne({
        _id: { $ne: id },
        name: body.name.trim(),
      });

      if (exists) {
        return c.json({ success: false, message: "Organization already exists" }, 409);
      }

      organization.name = body.name.trim();
    }

    if (body.industryType !== undefined) organization.industryType = body.industryType;
    if (body.email !== undefined) organization.email = body.email;
    if (body.mobile !== undefined) organization.mobile = body.mobile;
    if (body.address !== undefined) organization.address = body.address;
    if (body.isActive !== undefined) organization.isActive = body.isActive;

    await organization.save();

    return c.json({
      success: true,
      message: "Organization updated successfully",
      data: organization,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return c.json({ success: false, message: "Organization already exists" }, 409);
    }

    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteOrganization = async (c: Context) => {
  try {
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json({ success: false, message: "Invalid organization id" }, 400);
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      return c.json({ success: false, message: "Organization not found" }, 404);
    }

    organization.isActive = false;
    await organization.save();

    return c.json({
      success: true,
      message: "Organization deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};