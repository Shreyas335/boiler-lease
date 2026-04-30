import axios from "axios";

const API = "/api";

export interface AppNotification {
  id: number;
  notification_type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  related_listing_id: number | null;
  related_booking_id: number | null;
  related_offer_id: number | null;
  related_conversation_id: number | null;
}

export interface NotificationPreferences {
  new_message: boolean;
  booking_request: boolean;
  booking_confirmed: boolean;
  booking_declined: boolean;
  offer_received: boolean;
  offer_accepted: boolean;
  offer_declined: boolean;
  listing_approved: boolean;
  listing_rejected: boolean;
  broadcast: boolean;
}

export async function getNotifications(): Promise<AppNotification[]> {
  const { data } = await axios.get(`${API}/notifications/`, { withCredentials: true });
  return data;
}

export async function getUnreadNotifCount(): Promise<{ unread_count: number }> {
  const { data } = await axios.get(`${API}/notifications/unread-count/`, { withCredentials: true });
  return data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await axios.post(`${API}/notifications/${id}/read/`, {}, { withCredentials: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  await axios.post(`${API}/notifications/read-all/`, {}, { withCredentials: true });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await axios.get(`${API}/notifications/preferences/`, { withCredentials: true });
  return data;
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data } = await axios.patch(`${API}/notifications/preferences/`, patch, { withCredentials: true });
  return data;
}

export async function sendBroadcast(title: string, body: string, listingId?: number): Promise<{ sent_to: number }> {
  const payload: Record<string, unknown> = { title, body };
  if (listingId) payload.listing_id = listingId;
  const { data } = await axios.post(`${API}/company/broadcast/`, payload, { withCredentials: true });
  return data;
}
