import { createWithdrawal, listUserWithdrawals, listWithdrawalOptions, readWithdrawalProof } from "./withdrawal.service.js";
import { resolveProofPath } from "./proof.storage.js";

export async function getWithdrawalOptions(_req, res) {
  return res.json(listWithdrawalOptions());
}

export async function createMyWithdrawal(req, res) {
  try {
    const withdrawal = await createWithdrawal(req.user.id, req.body);
    return res.status(201).json({ withdrawal });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to submit withdrawal" });
  }
}

export async function getMyWithdrawals(req, res) {
  try {
    const withdrawals = await listUserWithdrawals(req.user.id);
    return res.json({ withdrawals });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load withdrawals" });
  }
}

export async function sendWithdrawalProof(req, res) {
  try {
    const filename = await readWithdrawalProof(req.params.id, req.user);
    const filePath = resolveProofPath(filename);
    if (!filePath) {
      return res.status(404).json({ message: "Payment screenshot not found" });
    }
    return res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load screenshot" });
  }
}
