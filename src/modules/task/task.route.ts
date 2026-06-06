import { Hono } from "hono";

import { auth } from "../../middleware/auth.middleware";

import { checkPermission } from "../../middleware/permission.middleware";

import { createTask, getAllTasks, getTaskById, updateTask,deleteTask, updateTaskStatus,} from "./task.controller";

export const taskRoutes = new Hono();

taskRoutes.post("/",auth,checkPermission("task:create"),  createTask);

taskRoutes.get("/",  auth,  checkPermission("task:view"),  getAllTasks);

taskRoutes.get("/:id", auth, checkPermission("task:view"), getTaskById);

taskRoutes.put("/:id", auth, checkPermission("task:update"), updateTask);
taskRoutes.patch("/status/:id", auth, checkPermission("task:update"), updateTaskStatus);

taskRoutes.delete("/:id",  auth,  checkPermission("task:delete"),  deleteTask);