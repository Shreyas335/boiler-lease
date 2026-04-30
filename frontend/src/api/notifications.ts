import api from "./axios";

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
  const { data } = await api.get<AppNotification[]>("/notifications/");
  return data;
}

export async function getUnreadNotifCount(): Promise<{ unread_count: number }> {
  const { data } = await api.get<{ unread_count: number }>("/notifications/unread-count/");
  return data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.post(`/notifications/${id}/read/`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all/", {});
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<NotificationPreferences>("/notifications/preferences/");
  return data;
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data } = await api.patch<NotificationPreferences>("/notifications/preferences/", patch);
  return data;
}

export async function sendBroadcast(title: string, body: string, listingId?: number): Promise<{ sent_to: number }> {
  const payload: Record<string, unknown> = { title, body };
  if (listingId) payload.listing_id = listingId;
  const { data } = await api.post<{ sent_to: number }>("/company/broadcast/", payload);
  return data;
}
