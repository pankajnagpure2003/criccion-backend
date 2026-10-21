import { handleCryptapiWebhook } from "../cryptapi.service.js";
import { verifyCryptapiSignature } from "./cryptapi.signature.js";

export async function cryptapiWebhook(req, res) {
  if (!verifyCryptapiSignature(req)) {
    return res.status(401).type("text/plain").send("Invalid signature");
  }

  try {
    const payload = req.method === "GET" ? req.query : req.body || {};
    await handleCryptapiWebhook(req.query, payload);
    return res.status(200).type("text/plain").send("*ok*");
  } catch (error) {
    console.error(error);
    const status = error.status && error.status < 500 ? error.status : 500;
    return res.status(status).type("text/plain").send(error.status ? error.message : "Webhook failed");
  }
}
