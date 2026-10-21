import { Router } from "express";
import { requireAdmin } from "../../middleware/auth.middleware.js";
import {
  adminApproveDeposit,
  adminGetDepositSettings,
  adminListDeposits,
  adminRejectDeposit,
  adminUpdateDepositSettings,
} from "./deposit-admin.controller.js";

const router = Router();

router.use(requireAdmin);
router.get("/settings", adminGetDepositSettings);
router.put("/settings", adminUpdateDepositSettings);
router.get("/", adminListDeposits);
router.post("/:id/approve", adminApproveDeposit);
router.post("/:id/reject", adminRejectDeposit);

export default router;
