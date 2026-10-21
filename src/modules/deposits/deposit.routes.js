import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { createDeposit, getDepositOptions, getMyDeposits, openCryptapiDeposit, refreshCryptapiDeposit } from "./deposit.controller.js";

const router = Router();

router.get("/options", requireAuth, getDepositOptions);
router.post("/cryptapi", requireAuth, openCryptapiDeposit);
router.get("/cryptapi", requireAuth, refreshCryptapiDeposit);
router.get("/", requireAuth, getMyDeposits);
router.post("/", requireAuth, createDeposit);

export default router;
