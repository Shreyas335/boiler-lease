import api from "./axios";
import type { User } from "../types/auth";

export async function fetchCsrfToken(): Promise<void> {
  await api.get("/auth/csrf/");
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await api.get<User>("/auth/me/");
    return data;
  } catch (error) {
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
  await api.post("/auth/logout/");
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

export async function login(email: string, password: string): Promise<LoginResponse> {
  await fetchCsrfToken();
  const { data } = await api.post<LoginResponse>("/auth/login/", { email, password });
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
