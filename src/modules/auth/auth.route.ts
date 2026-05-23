import { Hono } from "hono";

import { auth } from "../../middleware/auth.middleware";

import { login, me,} from "../auth/auth.controller";

export const authRoutes = new Hono();


// -----------------------------------------
// LOGIN
// -----------------------------------------

authRoutes.post("/login", login);


// -----------------------------------------
// GET LOGGED IN USER
// -----------------------------------------

authRoutes.get("/me",auth, me);