import crypto from "crypto";

export function generateReferralCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}
