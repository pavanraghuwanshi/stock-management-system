import { Hono } from "hono";

import { auth } from "../../middleware/auth.middleware";


import { createProjectDocument, getProjectDocuments, updateProjectDocument, deleteProjectDocument,} from "./projectDocument.controller";

const projectExtraRoutes = new Hono();

projectExtraRoutes.use("*", auth);


projectExtraRoutes.post("/documents/:projectId", createProjectDocument);

projectExtraRoutes.get( "/documents/:projectId", getProjectDocuments);

projectExtraRoutes.patch( "/documents/:id", updateProjectDocument);

projectExtraRoutes.delete( "/documents/:id", deleteProjectDocument);

export default projectExtraRoutes;