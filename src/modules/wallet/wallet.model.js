import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balanceUsdt: { type: Number, default: 0 },
    heldUsdt: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model("Wallet", walletSchema);
