import { Hono } from "hono";
import {
    createItem,
    getItems,
    getItemById,
    updateItem,
    deleteItem,
} from "./item.controller";
import { auth } from "../../middleware/auth.middleware";

const itemRoutes = new Hono();

itemRoutes.use("*", auth);

itemRoutes.post("/", createItem);
itemRoutes.get("/", getItems);
itemRoutes.get("/:id", getItemById);
itemRoutes.put("/:id", updateItem);
itemRoutes.delete("/:id", deleteItem);

export default itemRoutes;
