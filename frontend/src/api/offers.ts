import api from "./axios";

export interface PriceOffer {
  id: number;
  listing_id: number;
  listing_title: string;
  sublessee_id: number;
  sublessee_name: string;
  offered_price: string;
  note: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
}

export async function submitOffer(
  conversationId: number,
  offeredPrice: number,
  note: string
): Promise<PriceOffer> {
  const { data } = await api.post<PriceOffer>(
    `/messaging/conversations/${conversationId}/offers/`,
    { offered_price: offeredPrice, note }
  );
  return data;
}

export async function listOffers(statusFilter?: string): Promise<PriceOffer[]> {
  const params = statusFilter ? { status: statusFilter } : {};
  const { data } = await api.get<PriceOffer[]>("/offers/", { params });
  return data;
}

export async function respondToOffer(
  offerId: number,
  action: "accepted" | "declined"
): Promise<PriceOffer> {
  const { data } = await api.patch<PriceOffer>(`/offers/${offerId}/`, { action });
  return data;
}
