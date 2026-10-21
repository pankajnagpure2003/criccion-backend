import mongoose from "mongoose";

const cryptapiAddressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    network: { type: String, required: true, trim: true },
    ticker: { type: String, required: true, trim: true },
    nonce: { type: String, required: true, trim: true },
    addressIn: { type: String, required: true, trim: true },
    addressOut: { type: String, required: true, trim: true },
    callbackUrl: { type: String, required: true },
    minimumUsdt: { type: Number, default: 0 },
    qrCode: { type: String, default: "" },
  },
  { timestamps: true }
);

cryptapiAddressSchema.index({ user: 1, network: 1, addressOut: 1 }, { unique: true });
cryptapiAddressSchema.index({ user: 1, network: 1, nonce: 1 }, { unique: true });

export const CryptapiAddress = mongoose.model("CryptapiAddress", cryptapiAddressSchema);
