import { cryptapiNetwork } from "./gateways/cryptapi.client.js";

export const paymentMethods = [
  {
    id: "bank_transfer",
    label: "Bank Transfer",
    kind: "manual",
    enabled: true,
    fiatCurrency: "INR",
    creditsCurrency: "USDT",
  },
  {
    id: "upi",
    label: "UPI",
    kind: "manual",
    enabled: true,
    fiatCurrency: "INR",
    creditsCurrency: "USDT",
  },
  {
    id: "cryptapi",
    label: "USDT",
    kind: "gateway",
    enabled: true,
    fiatCurrency: "USDT",
    creditsCurrency: "USDT",
  },
];

export function findMethod(id) {
  return paymentMethods.find((method) => method.id === id) || null;
}

export function listDepositMethods(settings) {
  const destination = String(settings?.cryptapi?.address || "").trim();
  return paymentMethods.filter((method) => {
    if (!method.enabled) {
      return false;
    }
    if (method.kind === "manual") {
      return true;
    }
    return method.id === "cryptapi" && Boolean(destination);
  });
}

export function publicMethod(method, settings) {
  if (method.id === "bank_transfer") {
    return { ...baseMethod(method), instructions: settings.bank };
  }
  if (method.id === "upi") {
    return { ...baseMethod(method), instructions: settings.upi };
  }
  if (method.id === "cryptapi") {
    const network = cryptapiNetwork(settings.cryptapi?.network || "trc20");
    return {
      ...baseMethod(method),
      instructions: {
        network: network?.id || "trc20",
        networkLabel: network?.label || "TRC20",
      },
    };
  }
  return baseMethod(method);
}

function baseMethod(method) {
  return {
    id: method.id,
    label: method.label,
    kind: method.kind,
    fiatCurrency: method.fiatCurrency,
    creditsCurrency: method.creditsCurrency,
  };
}
