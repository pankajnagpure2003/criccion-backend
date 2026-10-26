import { Router } from "express";
import { adminLogin, adminTeam, listUsers, quickLoginUser, updateUser } from "./admin.controller.js";
import { requireAdmin } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/login", adminLogin);
router.get("/users", requireAdmin, listUsers);
router.get("/team/:id", requireAdmin, adminTeam);
router.post("/users/:id/quick-login", requireAdmin, quickLoginUser);
router.put("/users/:id", requireAdmin, updateUser);

export default router;
