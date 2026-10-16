import { Router } from "express";
import { forgotPassword, login, me, resendOtp, resetPassword, signup, verifyOtp } from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", requireAuth, me);

export default router;
