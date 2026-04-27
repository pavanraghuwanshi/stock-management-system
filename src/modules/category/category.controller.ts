import type { Context } from "hono";
import { Category } from "./category.model";

export const createCategory = async (c: Context) => {
    try {
        const body = await c.req.json();
        const category = await Category.create(body);
        return c.json({ success: true, data: category }, 201);
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const getCategories = async (c: Context) => {
    try {
        const categories = await Category.find().populate("groupIds", "name").sort({ createdAt: -1 });
        return c.json({ success: true, data: categories });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 500);
    }
};

export const getCategoryById = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const category = await Category.findById(id).populate("groupIds", "name");
        if (!category) {
            return c.json({ success: false, message: "Category not found" }, 404);
        }
        return c.json({ success: true, data: category });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const updateCategory = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const body = await c.req.json();
        const category = await Category.findByIdAndUpdate(id, body, {
            returnDocument: "after",
            runValidators: true,
        });
        if (!category) {
            return c.json({ success: false, message: "Category not found" }, 404);
        }
        return c.json({ success: true, data: category });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};

export const deleteCategory = async (c: Context) => {
    try {
        const id = c.req.param("id");
        const category = await Category.findByIdAndDelete(id);
        if (!category) {
            return c.json({ success: false, message: "Category not found" }, 404);
        }
        return c.json({ success: true, message: "Category deleted successfully" });
    } catch (error: any) {
        return c.json({ success: false, message: error.message }, 400);
    }
};
