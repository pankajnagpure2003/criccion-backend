import mongoose from "mongoose";

const holdSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountUsdt: { type: Number, required: true },
    source: { type: String, required: true, trim: true },
    sourceId: { type: String, required: true, trim: true },
    status: { type: String, enum: ["open", "captured", "released"], default: "open" },
  },
  { timestamps: true }
);

holdSchema.index({ source: 1, sourceId: 1 }, { unique: true });

export const WalletHold = mongoose.model("WalletHold", holdSchema);
