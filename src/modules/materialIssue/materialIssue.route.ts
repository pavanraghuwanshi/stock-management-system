import { Hono } from "hono";
import { auth } from "../../middleware/auth.middleware";
import {
  getAllMaterialStock,
  issueMaterialFromStock,
  getMaterialIssueHistory,
} from "./materialIssue.controller";

const purchaseOrderRoutes = new Hono();

const materialStockRoutes = new Hono();

materialStockRoutes.use("*", auth);

materialStockRoutes.get("/", auth, getAllMaterialStock);
materialStockRoutes.post("/issue", auth, issueMaterialFromStock);
materialStockRoutes.get("/issue-history", auth, getMaterialIssueHistory);

export default materialStockRoutes;