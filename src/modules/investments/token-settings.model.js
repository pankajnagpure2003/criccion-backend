import mongoose from "mongoose";

const tokenSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    tokensPerUsdt: { type: Number, default: null },
    configured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const TokenSettings = mongoose.model("TokenSettings", tokenSettingsSchema);
