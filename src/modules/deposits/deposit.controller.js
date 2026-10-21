import { createManualDeposit, listMethodsForUser, listUserDeposits } from "./deposit.service.js";
import { ensureCryptapiSession, readCryptapiSession } from "./cryptapi.service.js";

export async function getDepositOptions(_req, res) {
  try {
    const config = await listMethodsForUser();
    return res.json(config);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load deposit options" });
  }
}

export async function createDeposit(req, res) {
  try {
    const deposit = await createManualDeposit(req.user.id, req.body);
    return res.status(201).json({ deposit });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to submit deposit" });
  }
}

export async function openCryptapiDeposit(req, res) {
  try {
    const session = await ensureCryptapiSession(req.user.id);
    return res.json({ session });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to create USDT deposit address" });
  }
}

export async function refreshCryptapiDeposit(req, res) {
  try {
    const session = await readCryptapiSession(req.user.id);
    return res.json({ session });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to refresh USDT deposit" });
  }
}

export async function getMyDeposits(req, res) {
  try {
    const deposits = await listUserDeposits(req.user.id);
    return res.json({ deposits });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load deposits" });
  }
}
