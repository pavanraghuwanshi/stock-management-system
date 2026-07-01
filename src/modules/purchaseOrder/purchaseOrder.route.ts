import { Hono } from "hono";
import { auth } from "../../middleware/auth.middleware";
import {
  createPurchaseOrderFromIndent,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  markPurchaseOrderOrdered,
  receivePurchaseOrderMaterial,
  issueMaterialToRequester,
  cancelPurchaseOrder,
} from "./purchaseOrder.controller";

const purchaseOrderRoutes = new Hono();

purchaseOrderRoutes.use("*", auth);

purchaseOrderRoutes.post("/", createPurchaseOrderFromIndent);
purchaseOrderRoutes.get("/", getAllPurchaseOrders);
purchaseOrderRoutes.get("/:id", getPurchaseOrderById);

purchaseOrderRoutes.patch("/ordered/:id", markPurchaseOrderOrdered);
purchaseOrderRoutes.patch("/receive/:id", receivePurchaseOrderMaterial);
purchaseOrderRoutes.patch("/issue/:id", issueMaterialToRequester);
purchaseOrderRoutes.patch("/cancel/:id", cancelPurchaseOrder);

export default purchaseOrderRoutes;