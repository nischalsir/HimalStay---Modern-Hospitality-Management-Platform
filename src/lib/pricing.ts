// Centralized pricing breakdown — keeps server + client in sync.
// Hotel pricing in Nepal commonly adds 13% VAT and 10% service charge.
export const VAT_RATE = 0.13;
export const SERVICE_RATE = 0.10;
// Fallback NPR per USD used server-side (Khalti only accepts NPR).
export const SERVER_FALLBACK_NPR_PER_USD = 133.5;

export interface PriceBreakdown {
  subtotal: number;
  service: number;
  tax: number;
  total: number;
}

/** Build a tax/service breakdown from a pre-tax subtotal in USD. */
export function breakdown(subtotalUSD: number): PriceBreakdown {
  const subtotal = round2(subtotalUSD);
  const service = round2(subtotal * SERVICE_RATE);
  const tax = round2((subtotal + service) * VAT_RATE);
  const total = round2(subtotal + service + tax);
  return { subtotal, service, tax, total };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
