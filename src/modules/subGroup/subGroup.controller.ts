import type { Context } from "hono";
import { SubGroup } from "./subGroup.model";

export const createSubGroup = async (c: Context) => {
    try {
        const body = await c.req.json();
        const subGroup = await SubGroup.create(body);
        return c.json({ success: true, data: subGroup }, 201);
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const getSubGroups = async (c: Context) => {
    try {
        const subGroups = await SubGroup.find().populate("groupId", "name").sort({ createdAt: -1 });
        return c.json({ success: true, data: subGroups });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
};

export const getSubGroupById = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const subGroup = await SubGroup.findById(id).populate("groupId", "name");
        if (!subGroup) {
            return c.json({ success: false, message: "SubGroup not found" }, 404);
        }
        return c.json({ success: true, data: subGroup });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const updateSubGroup = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const subGroup = await SubGroup.findByIdAndUpdate(id, body, {
            returnDocument: "after",
            runValidators: true,
        });
        if (!subGroup) {
            return c.json({ success: false, message: "SubGroup not found" }, 404);
        }
        return c.json({ success: true, data: subGroup });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const deleteSubGroup = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const subGroup = await SubGroup.findByIdAndDelete(id);
        if (!subGroup) {
            return c.json({ success: false, message: "SubGroup not found" }, 404);
        }
        return c.json({ success: true, message: "SubGroup deleted successfully" });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};
