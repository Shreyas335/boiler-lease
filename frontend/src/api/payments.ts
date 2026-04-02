import api from "./axios";
import { fetchCsrfToken } from "./auth";

/** stripe checkout for deposit (only for sublessees w/ verified email). Need booking pay flow. */
export async function createDepositCheckoutSession(): Promise<{ checkout_url: string }> {
  await fetchCsrfToken();
  const { data } = await api.post<{ checkout_url: string }>("/payments/checkout/deposit/");
  return data;
}
