import mongoose from "mongoose";

const depositSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    inrPerUsdt: { type: Number, required: true, default: 90 },
    bank: {
      accountName: { type: String, default: "", trim: true },
      accountNumber: { type: String, default: "", trim: true },
      ifsc: { type: String, default: "", trim: true },
      bankName: { type: String, default: "", trim: true },
      branch: { type: String, default: "", trim: true },
    },
    upi: {
      upiId: { type: String, default: "", trim: true },
      payeeName: { type: String, default: "", trim: true },
    },
    cryptapi: {
      network: { type: String, enum: ["trc20", "erc20", "bep20"], default: "trc20" },
      address: { type: String, default: "", trim: true },
    },
  },
  { timestamps: true }
);

export const DepositSettings = mongoose.model("DepositSettings", depositSettingsSchema);

export async function ensureDepositSettings() {
  const existing = await DepositSettings.findOne({ key: "default" });
  if (existing) {
    return existing;
  }
  return DepositSettings.create({ key: "default" });
}
