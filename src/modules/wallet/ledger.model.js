import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    amountUsdt: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    source: { type: String, required: true, trim: true },
    sourceId: { type: String, required: true, trim: true },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

ledgerSchema.index({ source: 1, sourceId: 1 }, { unique: true });

export const LedgerEntry = mongoose.model("LedgerEntry", ledgerSchema);
