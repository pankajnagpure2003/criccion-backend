export function roundUsdt(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(amount * 1e6) / 1e6;
}

export function quoteUsdt(fiatAmount, inrPerUsdt) {
  const rate = Number(inrPerUsdt);
  const fiat = Number(fiatAmount);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(fiat) || fiat <= 0) {
    return 0;
  }
  return roundUsdt(fiat / rate);
}
