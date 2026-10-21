import mongoose from "mongoose";

const depositSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    method: { type: String, required: true, trim: true },
    fiatAmount: { type: Number, required: true },
    fiatCurrency: { type: String, required: true, default: "INR" },
    reference: { type: String, required: true, trim: true },
    note: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    usdtAmount: { type: Number, default: null },
    rateInrPerUsdt: { type: Number, default: null },
    rejectReason: { type: String, default: "", trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    network: { type: String, default: "", trim: true },
    providerUuid: { type: String, trim: true },
    txid: { type: String, default: "", trim: true },
    feeUsdt: { type: Number, default: null },
    confirmations: { type: Number, default: null },
  },
  { timestamps: true }
);

depositSchema.index({ providerUuid: 1 }, { unique: true, sparse: true });

export const Deposit = mongoose.model("Deposit", depositSchema);
