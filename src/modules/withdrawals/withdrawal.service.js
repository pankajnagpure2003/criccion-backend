import mongoose from "mongoose";
import { roundUsdt } from "../../utils/money.js";
import { captureFunds, releaseFunds, reserveFunds } from "../wallet/wallet.service.js";
import { findPayoutMethod, listPayoutMethods, publicPayoutMethod } from "./payout-methods.js";
import { removeProof } from "./proof.storage.js";
import { publicWithdrawal, Withdrawal } from "./withdrawal.model.js";

const TEXT_LIMIT = 160;

function cleanText(value, limit = TEXT_LIMIT) {
  return String(value || "").trim().slice(0, limit);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, "Withdrawal not found");
  }
}

function collectPayout(method, payout) {
  const source = payout && typeof payout === "object" ? payout : {};
  const clean = {};
  for (const field of method.fields) {
    const value = cleanText(source[field.key], field.max || TEXT_LIMIT);
    if (field.required && value.length < (field.min || 1)) {
      throw httpError(400, field.message || `Enter ${field.label}`);
    }
    if (value && field.check && !field.check(value)) {
      throw httpError(400, field.message || `Enter a valid ${field.label}`);
    }
    if (value) {
      clean[field.key] = value;
    }
  }
  return clean;
}

export function listWithdrawalOptions() {
  return { methods: listPayoutMethods().map(publicPayoutMethod) };
}

export async function createWithdrawal(userId, body) {
  const method = findPayoutMethod(body.method);
  if (!method) {
    throw httpError(400, "Choose bank transfer, UPI, or wallet address");
  }

  const amountUsdt = roundUsdt(body.amount);
  if (!(amountUsdt > 0) || amountUsdt > 1000000) {
    throw httpError(400, "Enter a valid USDT amount");
  }

  const payout = collectPayout(method, body.payout);
  const withdrawal = await Withdrawal.create({
    user: userId,
    amountUsdt,
    method: method.id,
    payout,
    note: cleanText(body.note, 300),
    status: "pending",
  });

  try {
    await reserveFunds({
      userId,
      amountUsdt,
      source: "withdrawal",
      sourceId: withdrawal._id,
    });
  } catch (error) {
    await Withdrawal.deleteOne({ _id: withdrawal._id });
    throw error;
  }

  return publicWithdrawal(withdrawal);
}

export async function listUserWithdrawals(userId) {
  const withdrawals = await Withdrawal.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
  return withdrawals.map(publicWithdrawal);
}

export async function listAdminWithdrawals(status) {
  const filter = {};
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    filter.status = status;
  }
  const withdrawals = await Withdrawal.find(filter)
    .populate("user", "name email mobile")
    .sort({ createdAt: -1 })
    .limit(100);
  return withdrawals.map(publicWithdrawal);
}

export async function approveWithdrawal(id, adminId, { proofFile, reference }) {
  assertId(id);
  if (!proofFile) {
    throw httpError(400, "Attach the payment screenshot");
  }

  const current = await Withdrawal.findById(id);
  if (!current) {
    throw httpError(404, "Withdrawal not found");
  }
  if (current.status !== "pending") {
    throw httpError(409, "This withdrawal is already reviewed");
  }

  await captureFunds({
    userId: current.user,
    source: "withdrawal",
    sourceId: current._id,
    note: `${current.method} ${current.amountUsdt} USDT`,
  });

  const withdrawal = await Withdrawal.findOneAndUpdate(
    { _id: current._id, status: "pending" },
    {
      status: "approved",
      proofFile,
      paymentReference: cleanText(reference, 80),
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
    { new: true }
  ).populate("user", "name email mobile");

  if (!withdrawal) {
    removeProof(proofFile);
    return publicWithdrawal(await Withdrawal.findById(current._id).populate("user", "name email mobile"));
  }

  return publicWithdrawal(withdrawal);
}

export async function rejectWithdrawal(id, adminId, body = {}) {
  assertId(id);
  const reason = cleanText(body.reason, 300);
  if (reason.length < 3) {
    throw httpError(400, "Enter a reject reason");
  }

  const withdrawal = await Withdrawal.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      status: "rejected",
      rejectReason: reason,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
    { new: true }
  ).populate("user", "name email mobile");

  if (!withdrawal) {
    const existing = await Withdrawal.findById(id);
    if (!existing) {
      throw httpError(404, "Withdrawal not found");
    }
    throw httpError(409, "This withdrawal is already reviewed");
  }

  try {
    await releaseFunds({
      userId: withdrawal.user._id || withdrawal.user,
      source: "withdrawal",
      sourceId: withdrawal._id,
    });
  } catch (error) {
    await Withdrawal.updateOne(
      { _id: withdrawal._id, status: "rejected" },
      { status: "pending", rejectReason: "", reviewedBy: null, reviewedAt: null }
    );
    throw error;
  }

  return publicWithdrawal(withdrawal);
}

export async function readWithdrawalProof(id, actor) {
  assertId(id);
  const withdrawal = await Withdrawal.findById(id).select("user proofFile status");
  if (!withdrawal?.proofFile) {
    throw httpError(404, "Payment screenshot not found");
  }

  const isOwner = String(withdrawal.user) === String(actor.id);
  if (actor.role !== "admin" && !isOwner) {
    throw httpError(403, "You cannot view this screenshot");
  }

  return withdrawal.proofFile;
}
