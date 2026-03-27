import api from "./axios";
import { fetchCsrfToken } from "./auth";

/** Deposit checkout; pass bookingId to charge that booking's snapshotted security deposit. */
export async function createDepositCheckoutSession(
  bookingId?: number
): Promise<{ checkout_url: string }> {
  await fetchCsrfToken();
  const { data } = await api.post<{ checkout_url: string }>("/payments/checkout/deposit/", {
    ...(bookingId != null ? { booking_id: bookingId } : {}),
  });
  return data;
}
