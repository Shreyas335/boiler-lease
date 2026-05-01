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
  managementFeeFlat: number;
  managementFeePercent: number;
  total: number;
}

export function computeBookingPriceBreakdown(
  monthlyRentStr: string,
  platformFeeFlatStr: string | undefined | null,
  managementFeePercentStr: string | null | undefined,
  startDate: string,
  endDate: string,
  platformFeePercentageStr?: string | null,
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

  const flatRaw = Number(platformFeeFlatStr ?? "0");
  const managementFeeFlat = Number.isFinite(flatRaw) && flatRaw > 0 ? flatRaw : 0;

  const cfgPctRaw = platformFeePercentageStr != null && platformFeePercentageStr !== "" ? Number(platformFeePercentageStr) : 0;
  const bookingPctRaw = managementFeePercentStr != null && managementFeePercentStr !== "" ? Number(managementFeePercentStr) : 0;
  const totalPct = (Number.isFinite(cfgPctRaw) ? cfgPctRaw : 0) + (Number.isFinite(bookingPctRaw) ? bookingPctRaw : 0);
  const managementFeePercent = (baseRent * totalPct) / 100;

  const total = baseRent + managementFeeFlat + managementFeePercent;

  return {
    nights,
    baseRent: round2(baseRent),
    managementFeeFlat: round2(managementFeeFlat),
    managementFeePercent: round2(managementFeePercent),
    total: round2(total),
  };
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
