import api from "./axios";
import type { BookingRecord } from "./listings";

export interface BookingGroupMember {
  id: number;
  user_id: number;
  username: string;
  email: string;
  display_name: string;
  status: "invited" | "confirmed";
  invited_at: string;
  confirmed_at: string | null;
}

export interface BookingGroup {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  memberships: BookingGroupMember[];
  booking_count: number;
  bookings?: BookingRecord[];
}

export async function getBookingGroups(): Promise<BookingGroup[]> {
  const { data } = await api.get<BookingGroup[]>("/groups/");
  return data;
}

export async function getBookingGroup(groupId: number): Promise<BookingGroup> {
  const { data } = await api.get<BookingGroup>(`/groups/${groupId}/`);
  return data;
}

export async function createBookingGroup(payload: {
  name: string;
  invitees: string[];
}): Promise<BookingGroup> {
  const { data } = await api.post<BookingGroup>("/groups/", payload);
  return data;
}

export async function inviteBookingGroupMembers(
  groupId: number,
  invitees: string[],
): Promise<BookingGroup> {
  const { data } = await api.post<BookingGroup>(`/groups/${groupId}/invite/`, { invitees });
  return data;
}

export async function acceptBookingGroupInvitation(membershipId: number): Promise<BookingGroup> {
  const { data } = await api.post<BookingGroup>(`/groups/invitations/${membershipId}/accept/`);
  return data;
}

export async function createGroupBooking(
  groupId: number,
  payload: { listing: number; start_date: string; end_date: string },
): Promise<BookingRecord> {
  const { data } = await api.post<BookingRecord>(`/groups/${groupId}/bookings/`, payload);
  return data;
}

export async function confirmGroupBooking(bookingId: number): Promise<BookingRecord> {
  const { data } = await api.post<BookingRecord>(`/groups/bookings/${bookingId}/confirm/`);
  return data;
}

export async function sendGroupBookingReminders(bookingId: number): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>(`/groups/bookings/${bookingId}/reminders/`);
  return data;
}
