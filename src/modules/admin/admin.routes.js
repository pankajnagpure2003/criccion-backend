import { Router } from "express";
import { adminLogin, listUsers } from "./admin.controller.js";
import { requireAdmin } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/login", adminLogin);
router.get("/users", requireAdmin, listUsers);

export default router;
