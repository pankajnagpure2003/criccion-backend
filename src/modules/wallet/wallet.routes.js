import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { getWallet } from "./wallet.controller.js";

const router = Router();

router.get("/", requireAuth, getWallet);

export default router;
