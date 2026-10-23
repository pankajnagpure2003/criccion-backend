import mongoose from "mongoose";
import { roundUsdt } from "../../utils/money.js";
import { creditTokens, debitAvailable, getOrCreateWallet, presentWallet, reverseDebit } from "../wallet/wallet.service.js";
import { Investment } from "./investment.model.js";
import { ReferralPlan } from "./referral-plan.model.js";
import { TokenSettings } from "./token-settings.model.js";

const MAX_LEVELS = 20;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function percentCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return null;
  }
  return Math.round(Number(amount.toFixed(2)) * 100);
}

function centsToPercent(cents) {
  return cents / 100;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function emptyTokenSettings() {
  return { tokensPerUsdt: null, configured: false };
}

export function presentTokenSettings(doc) {
  if (!doc?.configured || !(Number(doc.tokensPerUsdt) > 0)) {
    return emptyTokenSettings();
  }
  return {
    tokensPerUsdt: roundUsdt(doc.tokensPerUsdt),
    configured: true,
  };
}

function isPlanOpen(plan) {
  return Boolean(plan?.active && plan.amountUsdt > 0 && plan.durationDays >= 1);
}

export function presentPlan(doc) {
  if (!doc) {
    return null;
  }
  const plan = {
    id: doc._id,
    name: doc.name,
    durationDays: Number(doc.durationDays) || 0,
    amountUsdt: roundUsdt(doc.amountUsdt || 0),
    totalPercent: doc.totalPercent,
    levels: (doc.levels || []).map((level) => ({ level: level.level, percent: level.percent })),
    active: Boolean(doc.active),
  };
  return { ...plan, open: isPlanOpen(plan) };
}

function cleanPlanName(value) {
  const name = String(value || "").trim();
  if (!name || name.length > 80) {
    throw httpError(400, "Plan name is required");
  }
  return name;
}

function cleanDurationDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 10000) {
    throw httpError(400, "Duration must be a whole number of days from 1 to 10000");
  }
  return days;
}

function cleanPlanAmount(value) {
  const amount = roundUsdt(value);
  if (!Number.isFinite(Number(value)) || !(amount > 0)) {
    throw httpError(400, "Plan amount must be greater than 0");
  }
  return amount;
}

async function assertUniqueName(name, ignoreId = null) {
  const plans = await ReferralPlan.find(ignoreId ? { _id: { $ne: ignoreId } } : {});
  const taken = plans.some((plan) => plan.name.toLowerCase() === name.toLowerCase());
  if (taken) {
    throw httpError(400, "A plan with this name already exists");
  }
}

export async function listReferralPlans() {
  const docs = await ReferralPlan.find().sort({ active: -1, name: 1 });
  return docs.map(presentPlan);
}

export async function listActivePlans() {
  const docs = await ReferralPlan.find({ active: true }).sort({ name: 1 });
  return docs.map(presentPlan);
}

export async function createReferralPlan(body) {
  const name = cleanPlanName(body?.name);
  await assertUniqueName(name);
  const durationDays = cleanDurationDays(body?.durationDays);
  const amountUsdt = cleanPlanAmount(body?.amountUsdt);
  const plan = normalizePlan(body);
  const doc = await ReferralPlan.create({
    name,
    durationDays,
    amountUsdt,
    totalPercent: plan.totalPercent,
    levels: plan.levels,
    active: Boolean(body?.active),
  });
  return presentPlan(doc);
}

export async function updateReferralPlan(id, body) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, "Plan not found");
  }
  const doc = await ReferralPlan.findById(id);
  if (!doc) {
    throw httpError(404, "Plan not found");
  }
  const name = cleanPlanName(body?.name);
  await assertUniqueName(name, doc._id);
  const durationDays = cleanDurationDays(body?.durationDays);
  const amountUsdt = cleanPlanAmount(body?.amountUsdt);
  const plan = normalizePlan(body);
  doc.name = name;
  doc.durationDays = durationDays;
  doc.amountUsdt = amountUsdt;
  doc.totalPercent = plan.totalPercent;
  doc.levels = plan.levels;
  doc.active = Boolean(body?.active);
  await doc.save();
  return presentPlan(doc);
}

export async function deleteReferralPlan(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, "Plan not found");
  }
  const doc = await ReferralPlan.findByIdAndDelete(id);
  if (!doc) {
    throw httpError(404, "Plan not found");
  }
  return presentPlan(doc);
}

export async function setReferralPlanActive(id, active) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, "Plan not found");
  }
  const doc = await ReferralPlan.findById(id);
  if (!doc) {
    throw httpError(404, "Plan not found");
  }
  doc.active = Boolean(active);
  await doc.save();
  return presentPlan(doc);
}

export function presentInvestment(doc) {
  return {
    id: doc._id,
    amountUsdt: doc.amountUsdt,
    status: doc.status,
    lockedAt: doc.lockedAt,
    unlocksAt: doc.unlocksAt,
    claimedAt: doc.claimedAt,
    tokensPerUsdt: doc.tokensPerUsdt,
    tokensCredited: doc.tokensCredited,
    referralPlan: {
      planId: doc.referralPlan?.planId || null,
      name: doc.referralPlan?.name || "",
      durationDays: doc.referralPlan?.durationDays ?? null,
      amountUsdt: doc.referralPlan?.amountUsdt ?? null,
      totalPercent: doc.referralPlan?.totalPercent ?? 0,
      levels: (doc.referralPlan?.levels || []).map((level) => ({
        level: level.level,
        percent: level.percent,
      })),
    },
    referralPoolUsdt: doc.referralPoolUsdt,
    referralSettled: Boolean(doc.referralSettled),
  };
}

export function normalizePlan(body) {
  const totalCents = percentCents(body?.totalPercent);
  if (totalCents === null || totalCents < 0 || totalCents > 10000) {
    throw httpError(400, "Total referral percent must be from 0 to 100");
  }

  const rawLevels = Array.isArray(body?.levels) ? body.levels : null;
  if (!rawLevels) {
    throw httpError(400, "Referral levels are required");
  }
  if (rawLevels.length > MAX_LEVELS) {
    throw httpError(400, `A plan can have at most ${MAX_LEVELS} levels`);
  }
  if (totalCents === 0 && rawLevels.length > 0) {
    throw httpError(400, "Remove every level when the total referral percent is 0");
  }
  if (totalCents > 0 && rawLevels.length === 0) {
    throw httpError(400, "Add levels whose percents add up to the total");
  }

  const levels = rawLevels.map((row, index) => {
    const cents = percentCents(row?.percent);
    if (cents === null || cents <= 0) {
      throw httpError(400, `Level ${index + 1} percent must be greater than 0`);
    }
    return { level: index + 1, percent: centsToPercent(cents) };
  });

  const sumCents = levels.reduce((sum, level) => sum + percentCents(level.percent), 0);
  if (sumCents !== totalCents) {
    throw httpError(400, "Level percents must add up to the total referral percent");
  }

  return {
    totalPercent: centsToPercent(totalCents),
    levels,
  };
}

export async function getTokenSettings() {
  const doc = await TokenSettings.findOne({ key: "default" });
  return presentTokenSettings(doc);
}

export async function saveTokenSettings(body) {
  const rate = roundUsdt(body?.tokensPerUsdt);
  if (!Number.isFinite(Number(body?.tokensPerUsdt)) || !(rate > 0)) {
    throw httpError(400, "Tokens per 1 USDT must be greater than 0");
  }

  const doc = await TokenSettings.findOneAndUpdate(
    { key: "default" },
    { $set: { key: "default", tokensPerUsdt: rate, configured: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return presentTokenSettings(doc);
}

function lockedTotal(investments) {
  return roundUsdt(
    investments
      .filter((investment) => investment.status === "locked")
      .reduce((sum, investment) => sum + investment.amountUsdt, 0)
  );
}

export async function listInvestments(userId) {
  const [investments, wallet, tokenRate, plans] = await Promise.all([
    Investment.find({ user: userId }).sort({ createdAt: -1 }),
    getOrCreateWallet(userId),
    getTokenSettings(),
    listActivePlans(),
  ]);

  return {
    investments: investments.map(presentInvestment),
    wallet: presentWallet(wallet),
    tokenRate,
    plans,
    planConfigured: plans.length > 0,
    lockedUsdt: lockedTotal(investments),
  };
}

export async function createInvestment(userId, body) {
  if (!mongoose.isValidObjectId(body?.planId)) {
    throw httpError(400, "Choose a plan");
  }
  const plan = presentPlan(await ReferralPlan.findById(body.planId));
  if (!plan || !isPlanOpen(plan)) {
    throw httpError(400, "This plan is not open for investment");
  }

  const amount = roundUsdt(plan.amountUsdt);
  if (!(amount > 0)) {
    throw httpError(400, "This plan has no amount set");
  }

  const investmentId = new mongoose.Types.ObjectId();
  const lockedAt = new Date();
  const unlocksAt = addDays(lockedAt, plan.durationDays);

  const debit = await debitAvailable({
    userId,
    amountUsdt: amount,
    source: "investment",
    sourceId: investmentId,
    note: `${plan.durationDays} day purchase`,
  });

  if (debit.duplicate) {
    const existing = await Investment.findById(investmentId);
    if (existing) {
      return presentInvestment(existing);
    }
  }

  try {
    const investment = await Investment.create({
      _id: investmentId,
      user: userId,
      amountUsdt: amount,
      status: "locked",
      lockedAt,
      unlocksAt,
      referralPlan: {
        planId: plan.id,
        name: plan.name,
        durationDays: plan.durationDays,
        amountUsdt: amount,
        totalPercent: plan.totalPercent,
        levels: plan.levels.map((level) => ({ level: level.level, percent: level.percent })),
      },
      referralSettled: false,
    });
    return presentInvestment(investment);
  } catch (error) {
    await reverseDebit({
      userId,
      amountUsdt: amount,
      source: "investment",
      sourceId: investmentId,
    });
    throw error;
  }
}

export async function claimInvestment(userId, id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError(404, "Investment not found");
  }

  const existing = await Investment.findOne({ _id: id, user: userId });
  if (!existing) {
    throw httpError(404, "Investment not found");
  }
  if (existing.status === "claimed") {
    return presentInvestment(existing);
  }

  const now = new Date();
  if (existing.unlocksAt > now) {
    const days = existing.referralPlan?.durationDays;
    throw httpError(400, days ? `This purchase can be claimed after ${days} days` : "This purchase is not ready to claim");
  }

  const tokenRate = await getTokenSettings();
  const rate = roundUsdt(tokenRate.tokensPerUsdt);
  if (!tokenRate.configured || !(rate > 0)) {
    throw httpError(400, "Token rate is not set yet");
  }

  const tokensCredited = roundUsdt(existing.amountUsdt * rate);
  if (!(tokensCredited > 0)) {
    throw httpError(400, "Token amount must be greater than 0");
  }

  const referralPoolUsdt = roundUsdt((existing.amountUsdt * (existing.referralPlan?.totalPercent || 0)) / 100);
  const claimed = await Investment.findOneAndUpdate(
    { _id: id, user: userId, status: "locked", unlocksAt: { $lte: now } },
    {
      $set: {
        status: "claimed",
        claimedAt: now,
        tokensPerUsdt: rate,
        tokensCredited,
        referralPoolUsdt,
        referralSettled: false,
      },
    },
    { new: true }
  );

  if (!claimed) {
    const again = await Investment.findOne({ _id: id, user: userId });
    if (again?.status === "claimed") {
      return presentInvestment(again);
    }
    throw httpError(409, "This purchase cannot be claimed");
  }

  try {
    await creditTokens({ userId, amount: tokensCredited });
  } catch (error) {
    await Investment.updateOne(
      { _id: id, user: userId, status: "claimed" },
      {
        $set: {
          status: "locked",
          claimedAt: null,
          tokensPerUsdt: null,
          tokensCredited: null,
          referralPoolUsdt: null,
        },
      }
    );
    throw error;
  }

  return presentInvestment(claimed);
}
