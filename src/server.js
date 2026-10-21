import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectDb } from "./config/db.js";
import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import { seedAdmin } from "./modules/admin/admin.controller.js";
import walletRoutes from "./modules/wallet/wallet.routes.js";
import depositRoutes from "./modules/deposits/deposit.routes.js";
import depositAdminRoutes from "./modules/deposits/deposit-admin.routes.js";
import { ensureDepositSettings } from "./modules/deposits/deposit-settings.model.js";
import withdrawalRoutes from "./modules/withdrawals/withdrawal.routes.js";
import withdrawalAdminRoutes from "./modules/withdrawals/withdrawal-admin.routes.js";
import cryptapiWebhookRoutes from "./modules/deposits/gateways/cryptapi.routes.js";

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || origin === process.env.CLIENT_URL) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(
  express.json({
    verify(req, _res, buffer) {
      req.rawBody = buffer.toString("utf8");
    },
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/admin/deposits", depositAdminRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admin/withdrawals", withdrawalAdminRoutes);
app.use("/api/webhooks", cryptapiWebhookRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

async function start() {
  await connectDb();
  await seedAdmin();
  await ensureDepositSettings();
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
