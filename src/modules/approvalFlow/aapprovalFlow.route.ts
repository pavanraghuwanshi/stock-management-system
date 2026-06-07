import { Hono } from "hono";
import { auth } from "../../middleware/auth.middleware";
import { createApprovalFlow, getApprovalFlows, updateApprovalFlow, deleteApprovalFlow,} from "./approvalFlow.Controller";

const approvalFlowRoutes = new Hono();

approvalFlowRoutes.use("*", auth);

approvalFlowRoutes.post("/", createApprovalFlow);
approvalFlowRoutes.get("/", getApprovalFlows);
approvalFlowRoutes.patch("/:id", updateApprovalFlow);
approvalFlowRoutes.delete("/:id", deleteApprovalFlow);

export default approvalFlowRoutes;