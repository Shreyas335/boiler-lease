import api from "./axios";

export interface ConversationParticipant {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  user_type: string;
}

export interface ListingSummary {
  id: number;
  title: string;
  city: string;
  state: string;
}

export interface LastMessage {
  content: string;
  created_at: string;
  sender_id: number;
}

export interface Conversation {
  id: number;
  other_participant: ConversationParticipant;
  listing_summary: ListingSummary | null;
  last_message: LastMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation: number;
  sender_id: number;
  sender_username: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface PaginatedMessages {
  count: number;
  next: string | null;
  previous: string | null;
  results: Message[];
}

export interface BlockedUser {
  id: number;
  blocked_user: ConversationParticipant;
  created_at: string;
}

export async function listConversations(): Promise<Conversation[]> {
  const { data } = await api.get<Conversation[]>("/messaging/conversations/");
  return data;
}

export async function createOrGetConversation(
  recipientId: number,
  listingId: number | null,
  initialMessage: string
): Promise<Conversation> {
  const { data } = await api.post<Conversation>("/messaging/conversations/", {
    recipient_id: recipientId,
    listing_id: listingId ?? null,
    initial_message: initialMessage,
  });
  return data;
}

export async function getConversation(id: number): Promise<Conversation> {
  const { data } = await api.get<Conversation>(`/messaging/conversations/${id}/`);
  return data;
}

export async function deleteConversation(id: number): Promise<void> {
  await api.delete(`/messaging/conversations/${id}/`);
}

export async function listMessages(conversationId: number, page = 1): Promise<PaginatedMessages> {
  const { data } = await api.get<PaginatedMessages>(
    `/messaging/conversations/${conversationId}/messages/`,
    { params: { page } }
  );
  return data;
}

export async function sendMessage(conversationId: number, content: string): Promise<Message> {
  const { data } = await api.post<Message>(
    `/messaging/conversations/${conversationId}/messages/`,
    { content }
  );
  return data;
}

export async function markMessagesRead(conversationId: number): Promise<{ marked_read: number }> {
  const { data } = await api.post<{ marked_read: number }>(
    `/messaging/conversations/${conversationId}/read/`
  );
  return data;
}

export async function getUnreadCount(): Promise<{ unread_count: number }> {
  const { data } = await api.get<{ unread_count: number }>("/messaging/unread-count/");
  return data;
}

export async function listBlocks(): Promise<BlockedUser[]> {
  const { data } = await api.get<BlockedUser[]>("/messaging/blocks/");
  return data;
}

export async function blockUser(userId: number): Promise<void> {
  await api.post("/messaging/blocks/", { blocked_user_id: userId });
}

export async function unblockUser(userId: number): Promise<void> {
  await api.delete(`/messaging/blocks/${userId}/`);
}

export async function checkIsBlocked(userId: number): Promise<{ is_blocked: boolean }> {
  const { data } = await api.get<{ is_blocked: boolean }>(`/messaging/blocks/${userId}/`);
  return data;
}

export async function updateMessageNotificationPreference(enabled: boolean): Promise<void> {
  await api.patch("/account/", { message_notifications_enabled: enabled });
}
