import { getOrCreateWallet, listLedger, presentWallet } from "./wallet.service.js";

export async function getWallet(req, res) {
  try {
    const wallet = await getOrCreateWallet(req.user.id);
    const entries = await listLedger(req.user.id);
    return res.json({
      wallet: presentWallet(wallet),
      entries,
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load wallet" });
  }
}
