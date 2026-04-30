import type { AppNotification } from "../api/notifications";

export function notifDestination(n: AppNotification): string | null {
  if (n.related_conversation_id) return `/messages/${n.related_conversation_id}`;
  if (n.related_listing_id && n.notification_type === "booking_request") return `/booking-requests`;
  if (n.related_booking_id) return `/bookings/current`;
  if (n.related_offer_id) return `/offers`;
  if (n.related_listing_id) return `/properties/${n.related_listing_id}`;
  return null;
}
