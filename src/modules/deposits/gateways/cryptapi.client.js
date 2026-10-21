const NETWORKS = {
  trc20: { ticker: "trc20/usdt", coin: "trc20_usdt", label: "TRC20" },
  erc20: { ticker: "erc20/usdt", coin: "erc20_usdt", label: "ERC20" },
  bep20: { ticker: "bep20/usdt", coin: "bep20_usdt", label: "BEP20" },
};

export function listCryptapiNetworks() {
  return Object.entries(NETWORKS).map(([id, network]) => ({
    id,
    label: network.label,
    ticker: network.ticker,
    coin: network.coin,
  }));
}

export function cryptapiNetwork(id) {
  return NETWORKS[id] ? { id, ...NETWORKS[id] } : null;
}

async function cryptapiGet(pathname, params) {
  const url = new URL(`https://api.cryptapi.io/${pathname}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === "error") {
    const error = new Error(data.error || "CryptAPI request failed");
    error.status = 502;
    throw error;
  }
  return data;
}

export function createCryptapiAddress({ ticker, address, callback }) {
  return cryptapiGet(`${ticker}/create/`, {
    callback,
    address,
    pending: 1,
    post: 1,
    json: 1,
    confirmations: 1,
    multi_token: 0,
    convert: 0,
  });
}

export function getCryptapiInfo(ticker) {
  return cryptapiGet(`${ticker}/info/`);
}

export async function getCryptapiQr(ticker, address) {
  const data = await cryptapiGet(`${ticker}/qrcode/`, { address, size: 220 });
  return data.qr_code || "";
}

export function getCryptapiLogs(ticker, callback) {
  return cryptapiGet(`${ticker}/logs/`, { callback });
}
