import crypto from "crypto";

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}
