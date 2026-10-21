import { Router } from "express";
import { cryptapiWebhook } from "./cryptapi.webhook.js";

const router = Router();

router.get("/cryptapi", cryptapiWebhook);
router.post("/cryptapi", cryptapiWebhook);

export default router;
