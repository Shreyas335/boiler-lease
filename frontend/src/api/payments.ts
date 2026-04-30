import api from "./axios";
import { fetchCsrfToken } from "./auth";

export type TransactionStatus = "pending" | "succeeded" | "failed" | "canceled";

export interface PaymentTransaction {
  id: number;
  amount: string;
  currency: string;
  booking_reference: string;
  transaction_type: string;
  listing_title: string | null;
  listing_address: string | null;
  booking_start_date: string | null;
  booking_end_date: string | null;
  status: TransactionStatus;
  paid_at: string | null;
  created_at: string;
}

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

export async function fetchPaymentHistory(): Promise<PaymentTransaction[]> {
  const { data } = await api.get<PaymentTransaction[]>("/payments/history/");
  return data;
}
