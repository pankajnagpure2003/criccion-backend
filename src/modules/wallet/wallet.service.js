import { roundUsdt } from "../../utils/money.js";
import { WalletHold } from "./hold.model.js";
import { LedgerEntry } from "./ledger.model.js";
import { Wallet } from "./wallet.model.js";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function presentWallet(wallet) {
  const balanceUsdt = roundUsdt(wallet?.balanceUsdt || 0);
  const heldUsdt = roundUsdt(wallet?.heldUsdt || 0);
  return {
    balanceUsdt,
    heldUsdt,
    availableUsdt: roundUsdt(balanceUsdt - heldUsdt),
    currency: "USDT",
  };
}

export async function getOrCreateWallet(userId) {
  const existing = await Wallet.findOne({ user: userId });
  if (existing) {
    return existing;
  }

  try {
    return await Wallet.create({ user: userId, balanceUsdt: 0 });
  } catch (error) {
    if (error.code === 11000) {
      return Wallet.findOne({ user: userId });
    }
    throw error;
  }
}

export async function listLedger(userId, limit = 20) {
  return LedgerEntry.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
}

export async function creditWallet({ userId, amountUsdt, source, sourceId, note = "" }) {
  const amount = roundUsdt(amountUsdt);
  if (!(amount > 0)) {
    const error = new Error("Credit amount must be greater than 0");
    error.status = 400;
    throw error;
  }

  if (!source || !sourceId) {
    const error = new Error("Credit source is required");
    error.status = 400;
    throw error;
  }

  const existing = await LedgerEntry.findOne({ source, sourceId: String(sourceId) });
  if (existing) {
    return {
      wallet: await getOrCreateWallet(userId),
      entry: existing,
      duplicate: true,
    };
  }

  const wallet = await getOrCreateWallet(userId);
  wallet.balanceUsdt = roundUsdt(wallet.balanceUsdt + amount);
  await wallet.save();

  try {
    const entry = await LedgerEntry.create({
      user: userId,
      direction: "credit",
      amountUsdt: amount,
      balanceAfter: wallet.balanceUsdt,
      source,
      sourceId: String(sourceId),
      note,
    });
    return { wallet, entry, duplicate: false };
  } catch (error) {
    wallet.balanceUsdt = roundUsdt(Math.max(0, wallet.balanceUsdt - amount));
    await wallet.save();
    if (error.code === 11000) {
      const entry = await LedgerEntry.findOne({ source, sourceId: String(sourceId) });
      return { wallet, entry, duplicate: true };
    }
    throw error;
  }
}

export async function reserveFunds({ userId, amountUsdt, source, sourceId }) {
  const amount = roundUsdt(amountUsdt);
  if (!(amount > 0) || !source || !sourceId) {
    throw fail(400, "Reserve amount and source are required");
  }

  const sourceKey = String(sourceId);
  const existing = await WalletHold.findOne({ source, sourceId: sourceKey });
  if (existing) {
    return { wallet: await getOrCreateWallet(userId), hold: existing, duplicate: true };
  }

  await getOrCreateWallet(userId);
  const wallet = await Wallet.findOneAndUpdate(
    {
      user: userId,
      $expr: {
        $gte: [{ $subtract: ["$balanceUsdt", { $ifNull: ["$heldUsdt", 0] }] }, amount],
      },
    },
    { $inc: { heldUsdt: amount } },
    { new: true }
  );

  if (!wallet) {
    throw fail(400, "Not enough USDT available");
  }

  try {
    const hold = await WalletHold.create({
      user: userId,
      amountUsdt: amount,
      source,
      sourceId: sourceKey,
      status: "open",
    });
    return { wallet, hold, duplicate: false };
  } catch (error) {
    await Wallet.updateOne({ user: userId }, { $inc: { heldUsdt: -amount } });
    if (error.code === 11000) {
      const hold = await WalletHold.findOne({ source, sourceId: sourceKey });
      return { wallet: await getOrCreateWallet(userId), hold, duplicate: true };
    }
    throw error;
  }
}

export async function captureFunds({ userId, source, sourceId, note = "" }) {
  const sourceKey = String(sourceId);
  const hold = await WalletHold.findOne({ source, sourceId: sourceKey, status: "open" });
  if (!hold) {
    const done = await WalletHold.findOne({ source, sourceId: sourceKey, status: "captured" });
    if (done) {
      return {
        wallet: await getOrCreateWallet(userId),
        entry: await LedgerEntry.findOne({ source, sourceId: sourceKey }),
        duplicate: true,
      };
    }
    throw fail(409, "No reserved funds for this request");
  }

  const wallet = await Wallet.findOneAndUpdate(
    { user: userId, balanceUsdt: { $gte: hold.amountUsdt }, heldUsdt: { $gte: hold.amountUsdt } },
    { $inc: { balanceUsdt: -hold.amountUsdt, heldUsdt: -hold.amountUsdt } },
    { new: true }
  );

  if (!wallet) {
    throw fail(400, "Not enough USDT available");
  }

  try {
    const entry = await LedgerEntry.create({
      user: userId,
      direction: "debit",
      amountUsdt: hold.amountUsdt,
      balanceAfter: roundUsdt(wallet.balanceUsdt),
      source,
      sourceId: sourceKey,
      note,
    });
    hold.status = "captured";
    await hold.save();
    return { wallet, entry, duplicate: false };
  } catch (error) {
    await Wallet.updateOne(
      { user: userId },
      { $inc: { balanceUsdt: hold.amountUsdt, heldUsdt: hold.amountUsdt } }
    );
    if (error.code === 11000) {
      hold.status = "captured";
      await hold.save();
      return {
        wallet: await getOrCreateWallet(userId),
        entry: await LedgerEntry.findOne({ source, sourceId: sourceKey }),
        duplicate: true,
      };
    }
    throw error;
  }
}

export async function releaseFunds({ userId, source, sourceId }) {
  const sourceKey = String(sourceId);
  const hold = await WalletHold.findOneAndUpdate(
    { source, sourceId: sourceKey, status: "open" },
    { status: "released" },
    { new: false }
  );

  if (!hold) {
    const existing = await WalletHold.findOne({ source, sourceId: sourceKey });
    if (existing?.status === "released") {
      return { wallet: await getOrCreateWallet(userId), duplicate: true };
    }
    throw fail(409, "No reserved funds for this request");
  }

  await Wallet.updateOne({ user: userId }, { $inc: { heldUsdt: -hold.amountUsdt } });
  return { wallet: await getOrCreateWallet(userId), duplicate: false };
}
