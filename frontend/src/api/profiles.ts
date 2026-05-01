import api from "./axios";
import type { UserProfile, BlockedUser } from "../types/profile";

export async function getUserProfile(userId: number): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>(`/profiles/${userId}/`);
  return data;
}

export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>("/profiles/me/");
  return data;
}

export async function updateMyProfile(payload: {
  bio?: string;
  contact_phone?: string;
  first_name?: string;
  last_name?: string;
}): Promise<UserProfile> {
  const { data } = await api.patch<UserProfile>("/profiles/me/", payload);
  return data;
}

export async function uploadProfilePicture(
  file: File,
): Promise<{ profile_picture_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<{ profile_picture_url: string }>(
    "/profiles/me/picture/",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function rateUser(
  userId: number,
  score: number,
  review?: string,
): Promise<UserProfile> {
  const { data } = await api.post<UserProfile>(`/profiles/${userId}/rate/`, { score, review: review ?? "" });
  return data;
}

export async function blockUser(userId: number): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>(
    `/profiles/${userId}/block/`,
  );
  return data;
}

export async function unblockUser(userId: number): Promise<{ detail: string }> {
  const { data } = await api.delete<{ detail: string }>(
    `/profiles/${userId}/block/`,
  );
  return data;
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const { data } = await api.get<BlockedUser[]>("/profiles/blocked/");
  return data;
}
