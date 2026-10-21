import { Router } from "express";
import { requireAdmin } from "../../middleware/auth.middleware.js";
import { uploadProof } from "./proof.storage.js";
import { sendWithdrawalProof } from "./withdrawal.controller.js";
import { adminApproveWithdrawal, adminListWithdrawals, adminRejectWithdrawal } from "./withdrawal-admin.controller.js";

const router = Router();

router.use(requireAdmin);
router.get("/", adminListWithdrawals);
router.get("/:id/proof", sendWithdrawalProof);
router.post("/:id/approve", uploadProof, adminApproveWithdrawal);
router.post("/:id/reject", adminRejectWithdrawal);

export default router;
