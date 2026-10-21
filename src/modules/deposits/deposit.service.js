import mongoose from "mongoose";
import { quoteUsdt, roundUsdt } from "../../utils/money.js";
import { creditWallet } from "../wallet/wallet.service.js";
import { Deposit } from "./deposit.model.js";
import { DepositSettings, ensureDepositSettings } from "./deposit-settings.model.js";
import { findMethod, listDepositMethods, publicMethod } from "./payment-methods.js";
import { cryptapiNetwork } from "./gateways/cryptapi.client.js";

const TEXT_LIMIT = 120;

function cleanText(value, limit = TEXT_LIMIT) {
  return String(value || "").trim().slice(0, limit);
}

function cleanCryptapiAddress(network, value) {
  const address = cleanText(value, 128);
  if (!address) {
    return "";
  }
  const trc20 = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  const evm = /^0x[a-fA-F0-9]{40}$/.test(address);
  if (network === "trc20" && !trc20) {
    throw httpError(400, "Enter a TRC20 USDT address");
  }
  if (network !== "trc20" && !evm) {
    throw httpError(400, "Enter an ERC20 or BEP20 USDT address");
  }
  return address;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function getDepositConfig() {
  return ensureDepositSettings();
}

export async function listMethodsForUser() {
  const settings = await getDepositConfig();
  return {
    methods: listDepositMethods(settings).map((method) => publicMethod(method, settings)),
    rate: { inrPerUsdt: settings.inrPerUsdt, creditsCurrency: "USDT" },
  };
}

export async function createManualDeposit(userId, body) {
  const method = findMethod(body.method);
  if (!method || !method.enabled || method.kind !== "manual") {
    throw httpError(400, "Choose bank transfer or UPI");
  }

  const fiatAmount = Math.round(Number(body.amount) * 100) / 100;
  if (!(fiatAmount > 0) || fiatAmount > 10000000) {
    throw httpError(400, "Enter a valid amount");
  }

  const reference = cleanText(body.reference, 80);
  if (reference.length < 4) {
    throw httpError(400, "Enter the payment reference or UTR");
  }

  const deposit = await Deposit.create({
    user: userId,
    method: method.id,
    fiatAmount,
    fiatCurrency: method.fiatCurrency,
    reference,
    note: cleanText(body.note, 300),
    status: "pending",
  });

  return deposit;
}

export async function listUserDeposits(userId) {
  return Deposit.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
}

export async function listAdminDeposits(status) {
  const filter = {};
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    filter.status = status;
  }

  return Deposit.find(filter)
    .populate("user", "name email mobile")
    .sort({ createdAt: -1 })
    .limit(100);
}

function assertDepositId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, "Deposit not found");
  }
}

export async function approveDeposit(id, adminId, body = {}) {
  assertDepositId(id);
  const settings = await getDepositConfig();
  const current = await Deposit.findById(id);
  if (current?.method === "cryptapi") {
    throw httpError(400, "USDT deposits confirm on the blockchain");
  }
  if (!current) {
    throw httpError(404, "Deposit not found");
  }
  if (current.status !== "pending") {
    throw httpError(409, "This deposit is already reviewed");
  }

  const quoted = quoteUsdt(current.fiatAmount, settings.inrPerUsdt);
  const override = body.usdtAmount === undefined || body.usdtAmount === "" ? null : roundUsdt(body.usdtAmount);
  const usdtAmount = override === null ? quoted : override;

  if (!(usdtAmount > 0)) {
    throw httpError(400, "Set a USDT amount greater than 0. Check the INR to USDT rate.");
  }

  const deposit = await Deposit.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      status: "approved",
      usdtAmount,
      rateInrPerUsdt: settings.inrPerUsdt,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!deposit) {
    throw httpError(409, "This deposit is already reviewed");
  }

  try {
    await creditWallet({
      userId: deposit.user,
      amountUsdt: usdtAmount,
      source: "deposit",
      sourceId: deposit._id,
      note: `${deposit.method} ${deposit.fiatAmount} ${deposit.fiatCurrency}`,
    });
  } catch (error) {
    await Deposit.updateOne(
      { _id: deposit._id, status: "approved" },
      {
        status: "pending",
        usdtAmount: null,
        rateInrPerUsdt: null,
        reviewedBy: null,
        reviewedAt: null,
      }
    );
    throw error;
  }

  return Deposit.findById(deposit._id).populate("user", "name email mobile");
}

export async function rejectDeposit(id, adminId, body = {}) {
  assertDepositId(id);
  const reason = cleanText(body.reason, 300);
  if (reason.length < 3) {
    throw httpError(400, "Enter a reject reason");
  }

  const current = await Deposit.findById(id);
  if (current?.method === "cryptapi") {
    throw httpError(400, "USDT deposits confirm on the blockchain");
  }

  const deposit = await Deposit.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      status: "rejected",
      rejectReason: reason,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
    { new: true }
  ).populate("user", "name email mobile");

  if (!deposit) {
    const existing = await Deposit.findById(id);
    if (!existing) {
      throw httpError(404, "Deposit not found");
    }
    throw httpError(409, "This deposit is already reviewed");
  }

  return deposit;
}

export async function updateDepositSettings(body) {
  const settings = await getDepositConfig();
  const rate = Number(body.inrPerUsdt);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw httpError(400, "INR per USDT must be greater than 0");
  }

  settings.inrPerUsdt = roundUsdt(rate);
  settings.bank = {
    accountName: cleanText(body.bank?.accountName),
    accountNumber: cleanText(body.bank?.accountNumber),
    ifsc: cleanText(body.bank?.ifsc),
    bankName: cleanText(body.bank?.bankName),
    branch: cleanText(body.bank?.branch),
  };
  settings.upi = {
    upiId: cleanText(body.upi?.upiId),
    payeeName: cleanText(body.upi?.payeeName),
  };
  const networkId = body.cryptapi?.network || "trc20";
  if (!cryptapiNetwork(networkId)) {
    throw httpError(400, "Choose a USDT network");
  }
  settings.cryptapi = {
    network: networkId,
    address: cleanCryptapiAddress(networkId, body.cryptapi?.address),
  };
  settings.markModified("bank");
  settings.markModified("upi");
  settings.markModified("cryptapi");
  await settings.save();
  return settings;
}
