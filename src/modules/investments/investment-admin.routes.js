import { Router } from "express";
import { requireAdmin } from "../../middleware/auth.middleware.js";
import {
  adminSetReferralPlanActive,
  adminCreateReferralPlan,
  adminDeleteReferralPlan,
  adminGetTokenRate,
  adminListReferralPlans,
  adminSaveTokenRate,
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

export default router;
