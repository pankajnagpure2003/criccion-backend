import crypto from "crypto";

const CRYPTAPI_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3FT0Ym8b3myVxhQW7ESuuu6lo
dGAsUJs4fq+Ey//jm27jQ7HHHDmP1YJO7XE7Jf/0DTEJgcw4EZhJFVwsk6d3+4fy
Bsn0tKeyGMiaE6cVkX0cy6Y85o8zgc/CwZKc0uw6d5siAo++xl2zl+RGMXCELQVE
ox7pp208zTvown577wIDAQAB
-----END PUBLIC KEY-----`;

export function verifyCryptapiSignature(req) {
  try {
    const signatureB64 = req.get("x-ca-signature");
    if (!signatureB64) {
      return false;
    }

    const signature = Buffer.from(signatureB64, "base64");
    const payload = req.method === "GET" ? signedGetUrl(req) : req.rawBody || "";
    if (!payload) {
      return false;
    }

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(payload);
    return verifier.verify(CRYPTAPI_PUBLIC_KEY, signature);
  } catch (error) {
    console.error("CryptAPI signature check failed", error);
    return false;
  }
}

function signedGetUrl(req) {
  const base = String(process.env.PUBLIC_API_URL || "").replace(/\/$/, "");
  if (!base) {
    return "";
  }
  return `${base}${req.originalUrl}`;
}
