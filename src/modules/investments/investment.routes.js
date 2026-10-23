import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { getMyInvestments, postClaim, postInvestment } from "./investment.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", getMyInvestments);
router.post("/", postInvestment);
router.post("/:id/claim", postClaim);

export default router;
