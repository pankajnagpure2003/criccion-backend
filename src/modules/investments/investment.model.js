import mongoose from "mongoose";

const levelSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    percent: { type: Number, required: true },
  },
  { _id: false }
);

const investmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountUsdt: { type: Number, required: true },
    status: { type: String, enum: ["locked", "claimed"], default: "locked", index: true },
    lockedAt: { type: Date, required: true },
    unlocksAt: { type: Date, required: true },
    claimedAt: { type: Date, default: null },
    tokensPerUsdt: { type: Number, default: null },
    tokensCredited: { type: Number, default: null },
    referralPlan: {
      planId: { type: mongoose.Schema.Types.ObjectId, default: null },
      name: { type: String, default: "", trim: true },
      durationDays: { type: Number, default: null },
      amountUsdt: { type: Number, default: null },
      totalPercent: { type: Number, required: true },
      levels: { type: [levelSchema], default: [] },
    },
    referralPoolUsdt: { type: Number, default: null },
    referralSettled: { type: Boolean, default: false },
    claimStatus: { type: String, enum: [null, "pending", "approved", "rejected"], default: null },
    claimRequestedAt: { type: Date, default: null },
    claimPayoutMethod: { type: String, default: "", trim: true },
    claimPayout: { type: mongoose.Schema.Types.Mixed, default: null },
    claimNote: { type: String, default: "", trim: true },
    claimTxHash: { type: String, default: "", trim: true },
    claimRejectReason: { type: String, default: "", trim: true },
    claimReviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

investmentSchema.index({ user: 1, createdAt: -1 });

export const Investment = mongoose.model("Investment", investmentSchema);
