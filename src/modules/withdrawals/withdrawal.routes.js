import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { createMyWithdrawal, getMyWithdrawals, getWithdrawalOptions, sendWithdrawalProof } from "./withdrawal.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/options", getWithdrawalOptions);
router.get("/", getMyWithdrawals);
router.post("/", createMyWithdrawal);
router.get("/:id/proof", sendWithdrawalProof);

export default router;
