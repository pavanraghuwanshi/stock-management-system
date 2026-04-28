import type { Context } from "hono";
import { Group } from "./group.model";

export const createGroup = async (c: Context) => {
    try {
        const body = await c.req.json();
        const group = await Group.create(body);
        return c.json({ success: true, data: group }, 201);
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const getGroups = async (c: Context) => {
    try {
        const page = Number(c.req.query("page")) || 1;
        const limit = Number(c.req.query("limit")) || 10;
        const skip = (page - 1) * limit;

        const total = await Group.countDocuments();
        const groups = await Group.find().skip(skip).limit(limit).sort({ createdAt: -1 });

        return c.json({
            success: true,
            data: groups,
            pagination: {
                total,
                page,
                limit,
            },
        });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
};

export const getGroupById = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const group = await Group.findById(id);
        if (!group) {
            return c.json({ success: false, message: "Group not found" }, 404);
        }
        return c.json({ success: true, data: group });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const updateGroup = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const group = await Group.findByIdAndUpdate(id, body, {
            returnDocument: "after",
            runValidators: true,
        });
        if (!group) {
            return c.json({ success: false, message: "Group not found" }, 404);
        }
        return c.json({ success: true, data: group });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const deleteGroup = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const group = await Group.findByIdAndDelete(id);
        if (!group) {
            return c.json({ success: false, message: "Group not found" }, 404);
        }
        return c.json({ success: true, message: "Group deleted successfully" });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};
