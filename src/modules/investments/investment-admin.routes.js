import { Router } from "express";
import { requireAdmin } from "../../middleware/auth.middleware.js";
import {
  adminApproveClaimRequest,
  adminCreateReferralPlan,
  adminDeleteReferralPlan,
  adminGetTokenRate,
  adminListClaimRequests,
  adminListReferralPlans,
  adminRejectClaimRequest,
  adminSaveTokenRate,
  adminSetReferralPlanActive,
  adminUpdateReferralPlan,
} from "./investment-admin.controller.js";

const router = Router();

router.use(requireAdmin);
router.get("/token-rate", adminGetTokenRate);
router.put("/token-rate", adminSaveTokenRate);
router.get("/referral-plans", adminListReferralPlans);
router.post("/referral-plans", adminCreateReferralPlan);
router.put("/referral-plans/:id", adminUpdateReferralPlan);
router.delete("/referral-plans/:id", adminDeleteReferralPlan);
router.post("/referral-plans/:id/active", adminSetReferralPlanActive);
router.get("/claim-requests", adminListClaimRequests);
router.post("/claim-requests/:id/approve", adminApproveClaimRequest);
router.post("/claim-requests/:id/reject", adminRejectClaimRequest);

export default router;
