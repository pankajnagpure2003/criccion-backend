import crypto from "crypto";
import mongoose from "mongoose";
import { roundUsdt } from "../../utils/money.js";
import { creditWallet } from "../wallet/wallet.service.js";
import { Deposit } from "./deposit.model.js";
import { ensureDepositSettings } from "./deposit-settings.model.js";
import { CryptapiAddress } from "./cryptapi-address.model.js";
import {
  createCryptapiAddress,
  cryptapiNetwork,
  getCryptapiInfo,
  getCryptapiLogs,
  getCryptapiQr,
} from "./gateways/cryptapi.client.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function publicBaseUrl() {
  const base = String(process.env.PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  if (!base) {
    throw httpError(400, "Set PUBLIC_API_URL to the public API address before accepting USDT deposits");
  }
  return base;
}

async function destinationConfig() {
  const settings = await ensureDepositSettings();
  const networkId = settings.cryptapi?.network || "trc20";
  const network = cryptapiNetwork(networkId);
  const addressOut = String(settings.cryptapi?.address || "").trim();
  if (!network || !addressOut) {
    throw httpError(400, "USDT deposit address is not set yet");
  }
  return { network, addressOut };
}

async function syncAddressLogs(record) {
  const data = await getCryptapiLogs(record.ticker, record.callbackUrl);
  const callbacks = Array.isArray(data.callbacks) ? data.callbacks : [];
  for (const item of callbacks) {
    const confirmed = Array.isArray(item.logs) && item.logs.some((log) => Number(log.pending) === 0);
    const uuid = item.uuid || (item.txid_in ? `${item.txid_in}-${item.value_coin}` : "");
    await applyCryptapiPayment({
      userId: record.user,
      network: record.network,
      uuid,
      pending: confirmed ? 0 : 1,
      valueCoin: item.value_coin,
      feeCoin: item.fee_coin,
      forwardedCoin: item.value_forwarded_coin,
      txid: item.txid_in,
      confirmations: item.confirmations,
      coin: item.coin,
    });
  }
}

export async function applyCryptapiPayment({
  userId,
  network,
  uuid,
  pending,
  valueCoin,
  feeCoin,
  forwardedCoin,
  txid,
  confirmations,
  coin,
}) {
  if (!uuid || !mongoose.isValidObjectId(userId)) {
    return { ignored: true };
  }

  const networkInfo = cryptapiNetwork(network);
  if (coin && networkInfo && coin !== networkInfo.coin && !String(coin).includes("usdt")) {
    return { ignored: true };
  }

  const amount = roundUsdt(valueCoin);
  const isConfirmed = Number(pending) === 0;
  let deposit = await Deposit.findOne({ providerUuid: uuid });

  if (!deposit) {
    if (!(amount > 0)) {
      return { ignored: true };
    }
    try {
      deposit = await Deposit.create({
        user: userId,
        method: "cryptapi",
        fiatAmount: amount,
        fiatCurrency: "USDT",
        reference: String(txid || uuid).slice(0, 120),
        note: isConfirmed ? "" : "Waiting for blockchain confirmation",
        status: "pending",
        network,
        providerUuid: uuid,
        txid: txid || "",
        feeUsdt: feeCoin ?? null,
        confirmations: confirmations ?? null,
      });
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
      deposit = await Deposit.findOne({ providerUuid: uuid });
    }
  }

  if (!deposit || !isConfirmed || !(amount > 0) || deposit.status === "approved") {
    return { deposit, credited: false };
  }

  await creditWallet({
    userId: deposit.user,
    amountUsdt: amount,
    source: "cryptapi",
    sourceId: uuid,
    note: `USDT ${network}`,
  });

  deposit.status = "approved";
  deposit.fiatAmount = amount;
  deposit.usdtAmount = amount;
  deposit.feeUsdt = feeCoin ?? deposit.feeUsdt;
  deposit.confirmations = confirmations ?? deposit.confirmations;
  deposit.txid = txid || deposit.txid;
  deposit.reference = String(txid || deposit.reference || uuid).slice(0, 120);
  deposit.note = "";
  deposit.reviewedAt = new Date();
  await deposit.save();
  return { deposit, credited: true };
}

export async function ensureCryptapiSession(userId) {
  const { network, addressOut } = await destinationConfig();
  let record = await CryptapiAddress.findOne({ user: userId, network: network.id, addressOut });

  if (!record) {
    const nonce = crypto.randomBytes(24).toString("hex");
    const callbackUrl = `${publicBaseUrl()}/api/webhooks/cryptapi?user=${userId}&network=${network.id}&nonce=${nonce}`;
    try {
      const created = await createCryptapiAddress({
        ticker: network.ticker,
        address: addressOut,
        callback: callbackUrl,
      });
      if (!created.address_in) {
        throw httpError(502, "CryptAPI did not return a deposit address");
      }
      record = await CryptapiAddress.create({
        user: userId,
        network: network.id,
        ticker: network.ticker,
        nonce,
        addressIn: created.address_in,
        addressOut,
        callbackUrl: created.callback_url || callbackUrl,
        minimumUsdt: Number(created.minimum_transaction_coin) || 0,
      });
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
      record = await CryptapiAddress.findOne({ user: userId, network: network.id, addressOut });
    }
  }

  return presentSession(record, network);
}

export async function readCryptapiSession(userId) {
  const { network, addressOut } = await destinationConfig();
  const record = await CryptapiAddress.findOne({ user: userId, network: network.id, addressOut });
  if (!record) {
    return {
      network: network.id,
      networkLabel: network.label,
      addressIn: "",
      minimumUsdt: 0,
      qrCode: "",
    };
  }
  await syncAddressLogs(record).catch((error) => {
    console.error("CryptAPI log sync failed", error.message);
  });
  return presentSession(record, network);
}

async function presentSession(record, network) {
  if (!record.qrCode) {
    try {
      record.qrCode = await getCryptapiQr(record.ticker, record.addressIn);
    } catch (error) {
      console.error("CryptAPI QR failed", error.message);
    }
  }
  if (!(record.minimumUsdt > 0)) {
    try {
      const info = await getCryptapiInfo(record.ticker);
      record.minimumUsdt = Number(info.minimum_transaction_coin) || 0;
    } catch (error) {
      console.error("CryptAPI info failed", error.message);
    }
  }
  if (record.isModified()) {
    await record.save();
  }

  return {
    network: network.id,
    networkLabel: network.label,
    addressIn: record.addressIn,
    minimumUsdt: record.minimumUsdt || 0,
    qrCode: record.qrCode || "",
  };
}

export async function handleCryptapiWebhook(query, body) {
  const userId = query.user;
  const network = query.network;
  const nonce = query.nonce;
  if (!mongoose.isValidObjectId(userId) || !nonce || !cryptapiNetwork(network)) {
    throw httpError(403, "Invalid callback");
  }

  const record = await CryptapiAddress.findOne({ user: userId, network, nonce });
  if (!record) {
    throw httpError(403, "Invalid callback");
  }

  return applyCryptapiPayment({
    userId,
    network,
    uuid: body.uuid,
    pending: body.pending,
    valueCoin: body.value_coin,
    feeCoin: body.fee_coin,
    forwardedCoin: body.value_forwarded_coin,
    txid: body.txid_in,
    confirmations: body.confirmations,
    coin: body.coin,
  });
}
