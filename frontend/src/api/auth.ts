import api from "./axios";
import type { AxiosError } from "axios";
import type { User } from "../types/auth";

export async function fetchCsrfToken(): Promise<void> {
  await api.get("/auth/csrf/");
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await api.get<User>("/auth/me/");
    return data;
  } catch {
    // Return null if not authenticated (401/403) or any other error
    return null;
  }
}

export async function register(params: {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  user_type: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
}): Promise<User> {
  // Ensure CSRF token is fetched before register
  await fetchCsrfToken();
  const { data } = await api.post<User>("/auth/register/", params);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api.get("/auth/csrf/");
  } catch {
    // continue
  }
  try {
    await api.post("/auth/logout/");
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    // If session is already invalid (common after password change), treat as logged out.
    if (status === 401 || status === 403) return;
    throw error;
  }
}

// Login can return user OR requires_2fa + temp_token
export interface LoginResponse {
  requires_2fa?: boolean;
  temp_token?: string;
  id?: number;
  username?: string;
  email?: string;
  user_type?: string;
  first_name?: string;
  last_name?: string;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
}

export async function login(login: string, password: string): Promise<LoginResponse> {
  await fetchCsrfToken();
  const { data } = await api.post<LoginResponse>("/auth/login/", { login, password });
  return data;
}

export async function verify2FALogin(tempToken: string, code: string): Promise<User> {
  const { data } = await api.post<User>("/auth/2fa/", { temp_token: tempToken, code });
  return data;
}

export async function sendVerificationEmail(): Promise<void> {
  await api.post("/auth/send-verification-email/");
}

export async function verifyEmail(token: string): Promise<{ detail: string; user?: User }> {
  const { data } = await api.post<{ detail: string; user?: User }>("/auth/verify-email/", {
    token,
  });
  return data;
}

export async function twoFactorEnable(): Promise<void> {
  await api.post("/account/2fa/enable/");
}

export async function twoFactorDisable(): Promise<void> {
  await api.post("/account/2fa/disable/");
}

export interface UpdateAccountPayload {
  username?: string;
  first_name?: string;
  last_name?: string;
}

export async function getAccountProfile(): Promise<User> {
  const { data } = await api.get<User>("/account/");
  return data;
}

export async function updateAccountProfile(payload: UpdateAccountPayload): Promise<User> {
  const { data } = await api.patch<User>("/account/", payload);
  return data;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

export async function changePassword(payload: ChangePasswordPayload): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/account/password/", payload);
  return data;
}

export interface PasswordResetRequestPayload {
  email: string;
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload): Promise<{ detail: string }> {
  await fetchCsrfToken();
  const { data } = await api.post<{ detail: string }>("/auth/password-reset/request/", payload);
  return data;
}

export interface PasswordResetConfirmPayload {
  token: string;
  new_password: string;
  new_password_confirm: string;
}

export async function confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<{ detail: string }> {
  await fetchCsrfToken();
  const { data } = await api.post<{ detail: string }>("/auth/password-reset/confirm/", payload);
  return data;
}
