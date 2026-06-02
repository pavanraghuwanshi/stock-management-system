import { Hono } from "hono";
import {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
    getProjectStructure,
} from "./project.controller";
import { auth } from "../../middleware/auth.middleware";

const projectRoutes = new Hono();

projectRoutes.use("*", auth);

projectRoutes.post("/", createProject);
projectRoutes.get("/", getProjects);
projectRoutes.get("/:id", getProjectById);
projectRoutes.put("/:id", updateProject);
projectRoutes.delete("/:id", deleteProject);
projectRoutes.get("/structure/:projectId", getProjectStructure);

export default projectRoutes;
