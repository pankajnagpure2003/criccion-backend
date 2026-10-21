import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountUsdt: { type: Number, required: true },
    method: { type: String, required: true, trim: true },
    payout: { type: mongoose.Schema.Types.Mixed, required: true },
    note: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    proofFile: { type: String, default: "" },
    paymentReference: { type: String, default: "", trim: true },
    rejectReason: { type: String, default: "", trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

export function publicWithdrawal(withdrawal) {
  const item = typeof withdrawal.toObject === "function" ? withdrawal.toObject() : { ...withdrawal };
  const hasProof = Boolean(item.proofFile);
  delete item.proofFile;
  return { ...item, hasProof };
}
