/**
 * Prorated stay cost and fees (matches backend extension-style daily rate: monthly ÷ 30 per night).
 */

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BookingPriceBreakdown {
  nights: number;
  baseRent: number;
  platformFee: number;
  managementFee: number;
  total: number;
}

export function computeBookingPriceBreakdown(
  monthlyRentStr: string,
  platformFeePercentStr: string | undefined,
  managementFeePercentStr: string | null | undefined,
  startDate: string,
  endDate: string,
): BookingPriceBreakdown | null {
  if (!startDate || !endDate) return null;
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (nights <= 0) return null;

  const monthly = Number(monthlyRentStr);
  if (!Number.isFinite(monthly) || monthly < 0) return null;

  const baseRent = (monthly * nights) / 30;
  const platPct = Number(platformFeePercentStr ?? "0");
  const mgmtStr = managementFeePercentStr;
  const mgmtPct = mgmtStr != null && mgmtStr !== "" ? Number(mgmtStr) : 0;

  const platformFee = (baseRent * (Number.isFinite(platPct) ? platPct : 0)) / 100;
  const managementFee = (baseRent * (Number.isFinite(mgmtPct) ? mgmtPct : 0)) / 100;
  const total = baseRent + platformFee + managementFee;

  return {
    nights,
    baseRent: round2(baseRent),
    platformFee: round2(platformFee),
    managementFee: round2(managementFee),
    total: round2(total),
  };
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
